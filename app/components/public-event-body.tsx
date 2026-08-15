import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow } from "@/lib/database.types";
import { buildEventTabItems, type CompetitionWithNames } from "@/lib/build-event-tab-items";
import { PublicEventSwitcher } from "./public-event-switcher";
import { PublicRealtime } from "./public-realtime";
import { HomeDisciplineMenu } from "@/app/home-discipline-menu";

/** Cuerpo compartido de "ver un evento" en la sección pública — switcher de
 * jornadas arriba (para no depender de un link de "volver"), header del
 * evento, y el switcher de disciplinas/torneos con su contenido (posiciones
 * + fase final) ya resuelto. Usado por el inicio (evento activo del día),
 * /publico/[eventId] y /publico/[eventId]/[competitionId] (con
 * defaultCompetitionId) — antes eran tres vistas con estilos distintos. */
export async function PublicEventBody({
  supabase,
  event,
  competitions,
  switcherEvents,
  defaultCompetitionId,
  eyebrow,
}: {
  supabase: SupabaseClient;
  event: Pick<EventRow, "id" | "name" | "event_date" | "status">;
  competitions: CompetitionWithNames[];
  switcherEvents: EventRow[];
  defaultCompetitionId?: string;
  /** Texto chico arriba del título (ej. "Jornada de hoy") — solo lo usa el inicio. */
  eyebrow?: string;
}) {
  const tabItems = await buildEventTabItems(supabase, competitions);
  const liveIndex = tabItems.findIndex((t) => t.isLive);
  const defaultId =
    (defaultCompetitionId && tabItems.some((t) => t.id === defaultCompetitionId)
      ? defaultCompetitionId
      : undefined) ?? tabItems[liveIndex >= 0 ? liveIndex : 0]?.id;

  return (
    <div className="space-y-6">
      <PublicEventSwitcher events={switcherEvents} currentEventId={event.id} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark dark:text-brand-teal">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{event.name}</h1>
          <p className="panel-label text-sm">{event.event_date}</p>
        </div>
        {!eyebrow && (
          <span
            className={`text-xs rounded-full px-2.5 py-1 font-medium ${
              event.status === "active" ? "panel-chip-success" : "panel-chip"
            }`}
          >
            {event.status === "active" ? "En curso" : event.status === "finished" ? "Finalizado" : "Próximamente"}
          </span>
        )}
      </div>

      {tabItems.length === 0 ? (
        <p className="text-sm panel-label">Todavía no hay torneos cargados en esta jornada.</p>
      ) : (
        <>
          <PublicRealtime />
          <HomeDisciplineMenu items={tabItems} defaultId={defaultId} />
        </>
      )}
    </div>
  );
}
