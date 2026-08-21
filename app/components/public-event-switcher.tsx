import Link from "next/link";
import type { EventRow } from "@/lib/database.types";

/** Fila de pastillas para saltar de un evento a otro sin volver por
 * /publico — mismo lenguaje visual que HomeDisciplineMenu (el switcher de
 * disciplinas dentro de un evento), pero como links reales (cada evento es
 * una página con datos propios, no tiene sentido pre-cargar todos los
 * eventos como estado de cliente). Se muestra en el inicio y en
 * /publico/[eventId] para no depender de un link de "volver". */
export function PublicEventSwitcher({
  events,
  currentEventId,
}: {
  events: EventRow[];
  currentEventId?: string;
}) {
  if (events.length < 2) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 panel-enter-stagger" aria-label="Elegir jornada">
      {events.map((ev) => {
        const isActive = ev.id === currentEventId;
        return (
          <Link
            key={ev.id}
            href={`/publico/${ev.id}`}
            aria-current={isActive ? "true" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
              isActive
                ? "panel-button-primary"
                : "panel-chip hover:bg-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {ev.status === "active" && <span className="panel-live-dot shrink-0" aria-label="En vivo" />}
            {ev.name}
            <span className={isActive ? "opacity-80" : "opacity-60"}>· {ev.event_date}</span>
          </Link>
        );
      })}
    </nav>
  );
}
