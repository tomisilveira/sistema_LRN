import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";

export const revalidate = 0;

const statusLabel: Record<EventRow["status"], string> = {
  draft: "Próximamente",
  active: "En curso",
  finished: "Finalizado",
};

export default async function PublicEventsPage() {
  const supabase = await createServerSupabaseClient();
  // Consulta anónima (sin login): la tabla events solo tiene grant de
  // columnas puntuales para `anon` (ver 0003_accreditation.sql) — pedir "*"
  // incluiría accreditation_token, sin grant, y la query entera falla con
  // "permission denied for table events".
  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, status, created_at")
    .order("event_date", { ascending: false });

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Liga Robótica Neuquina</h1>
          <p className="text-neutral-400 text-sm mt-1">Jornadas</p>
        </div>
        <div className="space-y-2">
          {(events ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay jornadas publicadas.</p>
          )}
          {(events ?? []).map((ev: EventRow) => (
            <Link
              key={ev.id}
              href={`/publico/${ev.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
            >
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-sm text-neutral-500">{ev.event_date}</p>
              </div>
              <span className="text-xs rounded-full px-2 py-1 bg-neutral-800 text-neutral-300">
                {statusLabel[ev.status]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
