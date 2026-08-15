import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { disciplineColor } from "./discipline-colors";
import { competitionStatusLabel, competitionStatusChipClass } from "./labels";
import type { Competition, Group, GroupStandingRow, Match, Team } from "./database.types";
import type { DisciplineTabItem } from "@/app/home-discipline-menu";
import { PublicStandingsTable } from "@/app/components/public-standings-table";
import { PublicBracketView, type BracketDisplayMatch } from "@/app/components/public-bracket-view";

export type CompetitionWithNames = Competition & {
  disciplines: { name: string; sort_order: number } | null;
  categories: { name: string } | null;
};

export const LIVE_STATUSES = ["groups_in_progress", "bracket_in_progress"];

/** Arma el contenido (posiciones + cuadro) de cada torneo de un evento, para
 * el switcher de disciplinas (HomeDisciplineMenu) — compartido entre el
 * inicio y /publico/[eventId] (y su deep-link /publico/[eventId]/[competitionId])
 * para que las tres páginas muestren exactamente lo mismo. */
export async function buildEventTabItems(
  supabase: SupabaseClient,
  competitions: CompetitionWithNames[]
): Promise<DisciplineTabItem[]> {
  return Promise.all(competitions.map((c) => buildTabItem(supabase, c)));
}

async function buildTabItem(
  supabase: SupabaseClient,
  competition: CompetitionWithNames
): Promise<DisciplineTabItem> {
  const [{ data: teams }, { data: groups }, { data: bracketMatches }] = await Promise.all([
    supabase.from("teams").select("*").eq("competition_id", competition.id),
    supabase.from("groups").select("*").eq("competition_id", competition.id).order("sort_order"),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competition.id)
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

  const colors = disciplineColor(competition.disciplines);
  const isLive = LIVE_STATUSES.includes(competition.status);

  const content = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">
          {competition.disciplines?.name} — {competition.categories?.name}
        </h2>
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[competition.status]}`}
        >
          {competitionStatusLabel[competition.status]}
        </span>
      </div>

      {standingsByGroup.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold panel-label uppercase tracking-wide">
            Tabla de posiciones
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {standingsByGroup.map(({ group, rows }) => (
              <PublicStandingsTable key={group.id} groupName={group.name} rows={rows} />
            ))}
          </div>
        </section>
      )}

      {bracketDisplayMatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold panel-label uppercase tracking-wide">Fase Final</h3>
          <PublicBracketView matches={bracketDisplayMatches} />
        </section>
      )}

      {standingsByGroup.length === 0 && bracketDisplayMatches.length === 0 && (
        <p className="text-sm panel-label">Todavía no hay grupos ni resultados cargados.</p>
      )}
    </div>
  );

  return {
    id: competition.id,
    label: `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`,
    dotClass: colors.dot,
    isLive,
    content,
  };
}
