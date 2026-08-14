import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, EventRow } from "@/lib/database.types";
import { disciplineColor } from "@/lib/discipline-colors";
import { competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";

export const revalidate = 0;

type CompetitionWithNames = Competition & {
  disciplines: { name: string; sort_order: number } | null;
  categories: { name: string } | null;
};

export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  // Ver comentario equivalente en app/publico/page.tsx: `anon` solo tiene
  // grant de columnas puntuales sobre `events`, "*" rompe con permission
  // denied.
  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_date, status, created_at")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("*, disciplines(name, sort_order), categories(name)")
    .eq("event_id", eventId)
    .order("created_at");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/publico" className="text-xs panel-label hover:text-brand-teal transition-colors">
          ← Todas las jornadas
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">{event.name}</h1>
        <p className="panel-label text-sm">{event.event_date}</p>
      </div>
      <div className="space-y-2">
        {(competitions ?? []).length === 0 && (
          <p className="text-sm panel-label">Todavía no hay competencias cargadas.</p>
        )}
        {(competitions ?? []).map((c: CompetitionWithNames) => {
          const colors = disciplineColor(c.disciplines);
          return (
            <Link
              key={c.id}
              href={`/publico/${eventId}/${c.id}`}
              className={`panel-card flex items-center justify-between rounded-lg border-l-4 ${colors.border} px-4 py-3 hover:brightness-95 dark:hover:brightness-125 transition`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} aria-hidden="true" />
                <p className="font-medium">
                  {c.disciplines?.name} — {c.categories?.name}
                </p>
              </div>
              <span
                className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[c.status]}`}
              >
                {competitionStatusLabel[c.status]}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
