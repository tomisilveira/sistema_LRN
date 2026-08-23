import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { buildCourtBoards } from "@/lib/build-court-boards";
import { buildPantallaFallback } from "@/lib/build-pantalla-fallback";
import { PublicRealtime } from "@/app/components/public-realtime";
import { ScreenBoards } from "./screen-boards";
import { ScreenFallback } from "./screen-fallback";

export const revalidate = 0;

// Mismo criterio de columnas públicas que /publico (ver comentario
// equivalente en app/page.tsx): `anon` solo tiene grant de columnas
// puntuales sobre `events`.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

/** "Modo pantalla": vista standalone para proyector/TV en el evento — sin
 * header ni navegación, solo la cancha. Deliberadamente NO reusa
 * PublicShell (esa navegación es para alguien mirando desde el celular, acá
 * nadie va a tocar nada). Mismo criterio de acceso que /publico/[eventId]:
 * 404 si el evento no es público.
 *
 * Dos estados, sin ningún paso manual — `PublicRealtime` dispara
 * `router.refresh()` en cualquier cambio de `matches` y el paso de uno a
 * otro ocurre solo:
 * - Hay algún partido en vivo en el evento → se muestra ÚNICAMENTE eso
 *   (ScreenBoards, filtrado a las canchas con partido en curso), con los
 *   próximos partidos de esa cancha debajo.
 * - Nadie está jugando ahora mismo → una tarjeta por torneo con su fase
 *   actual (tabla de posiciones o cuadro, ver ScreenFallback) y, si hay
 *   algo programado, los próximos partidos del evento abajo. */
export default async function PantallaPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event || !event.is_public) notFound();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("*, disciplines(name, sort_order), categories(name)")
    .eq("event_id", eventId)
    .order("created_at");
  const competitionList = (competitions ?? []) as CompetitionWithNames[];

  const boards = await buildCourtBoards(supabase, eventId, competitionList);
  const liveBoards = boards.filter((b) => b.live !== null);
  const hasLive = liveBoards.length > 0;
  const upcoming = hasLive ? [] : boards.flatMap((b) => b.upcoming);

  const fallbackBoards = hasLive ? [] : await buildPantallaFallback(supabase, eventId, competitionList);

  return (
    <div className="panel-page min-h-screen">
      <PublicRealtime />
      <div className="p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 panel-enter">
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1 panel-brand-dots" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-teal" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-orange" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-pink" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
            </span>
            <h1 className="text-2xl font-display font-bold">{event.name}</h1>
          </div>
          <p className="text-sm panel-label">{event.event_date}</p>
        </header>

        {hasLive ? <ScreenBoards boards={liveBoards} /> : <ScreenFallback boards={fallbackBoards} />}

        {upcoming.length > 0 && (
          <section className="panel-card rounded-xl p-4 space-y-2 panel-enter">
            <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
              Próximos partidos
            </p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {upcoming.map((m) => (
                <p key={m.match.id} className="text-sm panel-label truncate">
                  {m.teamAName} <span className="opacity-60">vs</span> {m.teamBName}
                  <span className="opacity-60"> — {m.disciplineCategory}</span>
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
