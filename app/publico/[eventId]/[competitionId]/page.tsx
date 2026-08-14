import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Competition,
  Discipline,
  Category,
  Team,
  Group,
  Match,
  GroupStandingRow,
} from "@/lib/database.types";
import { PublicRealtime } from "./public-realtime";
import { PublicStandingsTable } from "./public-standings-table";
import { PublicBracketView, type BracketDisplayMatch } from "./public-bracket-view";

export const revalidate = 0;

export default async function PublicCompetitionPage({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .maybeSingle<Competition>();
  if (!competition) notFound();

  const [{ data: discipline }, { data: category }, { data: event }, { data: teams }, { data: groups }, { data: bracketMatches }] =
    await Promise.all([
      supabase.from("disciplines").select("*").eq("id", competition.discipline_id).single<Discipline>(),
      supabase.from("categories").select("*").eq("id", competition.category_id).single<Category>(),
      supabase.from("events").select("id, name").eq("id", eventId).single(),
      supabase.from("teams").select("*").eq("competition_id", competitionId),
      supabase.from("groups").select("*").eq("competition_id", competitionId).order("sort_order"),
      supabase
        .from("matches")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("phase", "bracket")
        .order("bracket_slot"),
    ]);

  const teamsById = new Map((teams ?? []).map((t: Team) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];

  const standingsByGroup = await Promise.all(
    groupsList.map(async (g) => {
      try {
        const { data, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
        if (error) throw error;
        return { group: g, rows: (data ?? []) as GroupStandingRow[] };
      } catch (err) {
        console.error(`get_group_standings falló para el grupo ${g.id}:`, err);
        return { group: g, rows: [] as GroupStandingRow[] };
      }
    })
  );

  const bracketDisplayMatches: BracketDisplayMatch[] = (bracketMatches ?? []).map((m: Match) => ({
    ...m,
    team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
    team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
  }));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <PublicRealtime competitionId={competitionId} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href={`/publico/${eventId}`} className="text-xs text-neutral-500 hover:text-neutral-300">
            ← {event?.name}
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {discipline?.name} — {category?.name}
          </h1>
        </div>

        {standingsByGroup.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Tabla de posiciones
            </h2>
            <div className="grid sm:grid-cols-2 gap-8">
              {standingsByGroup.map(({ group, rows }) => (
                <PublicStandingsTable key={group.id} groupName={group.name} rows={rows} />
              ))}
            </div>
          </section>
        )}

        {bracketDisplayMatches.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Cuadro eliminatorio
            </h2>
            <PublicBracketView matches={bracketDisplayMatches} />
          </section>
        )}

        {standingsByGroup.length === 0 && bracketDisplayMatches.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no hay grupos ni resultados cargados.</p>
        )}
      </div>
    </main>
  );
}
