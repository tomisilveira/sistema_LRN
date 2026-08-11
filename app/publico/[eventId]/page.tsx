import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, EventRow } from "@/lib/database.types";

export const revalidate = 0;

export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("*, disciplines(name), categories(name)")
    .eq("event_id", eventId)
    .order("created_at");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-neutral-400 text-sm mt-1">{event.event_date}</p>
        </div>
        <div className="space-y-2">
          {(competitions ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay competencias cargadas.</p>
          )}
          {(competitions ?? []).map(
            (
              c: Competition & {
                disciplines: { name: string } | null;
                categories: { name: string } | null;
              }
            ) => (
              <Link
                key={c.id}
                href={`/publico/${eventId}/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
              >
                <p className="font-medium">
                  {c.disciplines?.name} — {c.categories?.name}
                </p>
                <span className="text-xs text-neutral-500">Ver en vivo →</span>
              </Link>
            )
          )}
        </div>
      </div>
    </main>
  );
}
