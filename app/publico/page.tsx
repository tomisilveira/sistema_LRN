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
  // puntuales sobre `events` (ver 0003_accreditation.sql) — pedir "*"
  // incluiría accreditation_token, sin grant, y la query entera falla con
  // "permission denied for table events".
  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, status, created_at")
    .order("event_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Jornadas</h1>
      </div>
      <div className="space-y-2">
        {(events ?? []).length === 0 && (
          <p className="text-sm panel-label">Todavía no hay jornadas publicadas.</p>
        )}
        {(events ?? []).map((ev: EventRow) => (
          <Link
            key={ev.id}
            href={`/publico/${ev.id}`}
            className="panel-card flex items-center justify-between rounded-lg px-4 py-3 hover:brightness-95 dark:hover:brightness-125 transition"
          >
            <div>
              <p className="font-medium">{ev.name}</p>
              <p className="text-sm panel-label">{ev.event_date}</p>
            </div>
            <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusChipClass[ev.status]}`}>
              {statusLabel[ev.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
