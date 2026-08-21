import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";

export const revalidate = 0;

const statusLabel: Record<EventRow["status"], string> = {
  draft: "Próximamente",
  active: "En curso",
  finished: "Finalizado",
};

const statusChipClass: Record<EventRow["status"], string> = {
  draft: "panel-chip",
  active: "panel-chip-success",
  finished: "panel-chip-brand",
};

export default async function PublicEventsPage() {
  const supabase = await createServerSupabaseClient();
  // Consulta anónima (sin login): `anon` solo tiene grant de columnas
  // puntuales sobre `events` (ver 0003_accreditation.sql, 0005_event_visibility.sql)
  // — pedir "*" incluiría accreditation_token, sin grant, y la query entera
  // falla con "permission denied for table events".
  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, status, is_public, created_at")
    .eq("is_public", true)
    .order("event_date", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Mismo tratamiento de "portada" que el inicio (app/page.tsx) cuando
          no hay torneo en vivo — para que se sienta la misma página y no una
          lista aparte con otro estilo. */}
      <div className="text-center space-y-2 py-6">
        <h1 className="text-xl sm:text-2xl font-bold">Liga Robótica Neuquina</h1>
        <p className="panel-label text-sm">Todas las jornadas</p>
      </div>
      <div className="space-y-2 panel-enter-stagger">
        <p className="text-xs panel-label uppercase tracking-wide mb-1">Jornadas</p>
        {(events ?? []).length === 0 && (
          <p className="text-sm panel-label">Todavía no hay jornadas publicadas.</p>
        )}
        {(events ?? []).map((ev: EventRow) => (
          <Link
            key={ev.id}
            href={`/publico/${ev.id}`}
            className="panel-card-button group flex items-center justify-between gap-3 rounded-xl px-4 py-3.5"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{ev.name}</p>
              <p className="text-sm panel-label">{ev.event_date}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusChipClass[ev.status]}`}>
                {statusLabel[ev.status]}
              </span>
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
  );
}
