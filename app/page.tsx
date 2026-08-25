import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { PublicShell } from "@/app/components/public-shell";
import { PublicEventBody } from "@/app/components/public-event-body";
import { BrandLockup } from "@/app/components/brand-mark";

export const revalidate = 0;

// Consulta anónima (sin login): `anon` solo tiene grant de columnas
// puntuales sobre `events` (ver 0003_accreditation.sql, 0005_event_visibility.sql)
// — pedir "*" incluiría accreditation_token, sin grant, y la query entera
// falla con "permission denied for table events".
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  // La jornada de hoy: como mucho un evento debería estar "activo" a la vez.
  const { data: activeEvents } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("status", "active")
    .eq("is_public", true)
    .order("event_date", { ascending: false })
    .limit(1);
  const activeEvent = (activeEvents ?? [])[0] as EventRow | undefined;

  // Eventos públicos para el switcher de jornadas (arriba de todo) — se
  // muestra igual haya o no un evento activo hoy, para poder saltar directo
  // a otra jornada sin pasar por /publico.
  const { data: switcherEventsRaw } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("is_public", true)
    .neq("status", "finished")
    .order("event_date", { ascending: true });
  const switcherEvents = (switcherEventsRaw ?? []) as EventRow[];

  let competitions: CompetitionWithNames[] = [];
  if (activeEvent) {
    const { data } = await supabase
      .from("competitions")
      .select("*, disciplines(name, sort_order), categories(name)")
      .eq("event_id", activeEvent.id)
      .order("created_at");
    competitions = (data ?? []) as CompetitionWithNames[];
  }

  return (
    <PublicShell>
      {activeEvent ? (
        <PublicEventBody
          supabase={supabase}
          event={activeEvent}
          competitions={competitions}
          switcherEvents={switcherEvents}
          eyebrow="Jornada de hoy"
        />
      ) : (
        <UpcomingEvents events={switcherEvents} />
      )}
    </PublicShell>
  );
}

function UpcomingEvents({ events }: { events: EventRow[] }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3 py-8">
        <h1 className="sr-only">Liga Robótica Neuquina</h1>
        <BrandLockup className="h-10 sm:h-12 w-auto mx-auto" />
        <p className="panel-label text-sm">No hay ningún torneo en vivo en este momento.</p>
      </div>
      <div>
        <p className="text-xs panel-label uppercase tracking-wide mb-3">Próximas fechas</p>
        <div className="space-y-2 panel-enter-stagger">
          {events.length === 0 && (
            <p className="text-sm panel-label">Todavía no hay jornadas programadas.</p>
          )}
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/publico/${ev.id}`}
              className="panel-card-button group flex items-center justify-between gap-3 rounded-xl px-4 py-3.5"
            >
              <p className="font-medium truncate">{ev.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm panel-label">{ev.event_date}</span>
                <span
                  className="panel-label text-lg leading-none transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
