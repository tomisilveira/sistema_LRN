import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { disciplineColor } from "./discipline-colors";
import { competitionStatusLabel, competitionStatusChipClass } from "./labels";
import type { Competition, Court, Group, GroupStandingRow, Match, Team } from "./database.types";
import type { DisciplineTabItem } from "@/app/home-discipline-menu";
import { PublicStandingsTable } from "@/app/components/public-standings-table";
import { PublicBracketView, type BracketDisplayMatch } from "@/app/components/public-bracket-view";
import { PublicMatchList, type PublicMatchDisplay } from "@/app/components/public-match-list";
import type { LiveMatchInfo } from "@/app/components/public-live-now-panel";

export type CompetitionWithNames = Competition & {
  disciplines: { name: string; sort_order: number } | null;
  categories: { name: string } | null;
};

export const LIVE_STATUSES = ["groups_in_progress", "bracket_in_progress"];

export interface EventTabsResult {
  tabItems: DisciplineTabItem[];
  /** Partidos en curso AHORA mismo en cualquier torneo del evento, para el
   * apartado fijo de arriba (PublicLiveNowPanel) — junta grupo + cuadro. */
  liveMatches: LiveMatchInfo[];
}

/** Arma el contenido (fixture + posiciones + fase final) de cada torneo de
 * un evento, para el switcher de disciplinas (HomeDisciplineMenu) —
 * compartido entre el inicio y /publico/[eventId] (y su deep-link
 * /publico/[eventId]/[competitionId]) para que las tres páginas muestren
 * exactamente lo mismo. */
export async function buildEventTabItems(
  supabase: SupabaseClient,
  eventId: string,
  competitions: CompetitionWithNames[]
): Promise<EventTabsResult> {
  const { data: courts } = await supabase.from("courts").select("id, name").eq("event_id", eventId);
  const courtNameById = new Map((courts ?? []).map((c: Pick<Court, "id" | "name">) => [c.id, c.name]));

  const built = await Promise.all(competitions.map((c) => buildTabItem(supabase, c, courtNameById)));

  return {
    tabItems: built.map((b) => b.tabItem),
    liveMatches: built.flatMap((b) => b.liveMatches),
  };
}

async function buildTabItem(
  supabase: SupabaseClient,
  competition: CompetitionWithNames,
  courtNameById: Map<string, string>
): Promise<{ tabItem: DisciplineTabItem; liveMatches: LiveMatchInfo[] }> {
  const [{ data: teams }, { data: groups }, { data: groupMatches }, { data: bracketMatches }] =
    await Promise.all([
      supabase.from("teams").select("*").eq("competition_id", competition.id),
      supabase.from("groups").select("*").eq("competition_id", competition.id).order("sort_order"),
      supabase
        .from("matches")
        .select("*")
        .eq("competition_id", competition.id)
        .eq("phase", "group")
        .order("turno"),
      supabase
        .from("matches")
        .select("*")
        .eq("competition_id", competition.id)
        .eq("phase", "bracket")
        .order("bracket_slot"),
    ]);

  const teamsById = new Map((teams ?? []).map((t: Team) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];
  const teamName = (id: string | null) => (id ? teamsById.get(id)?.name ?? "?" : "?");

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

  const groupMatchDisplays: PublicMatchDisplay[] = ((groupMatches ?? []) as Match[]).map((m) => ({
    ...m,
    team_a_name: teamName(m.team_a_id),
    team_b_name: teamName(m.team_b_id),
    court_name: m.court_id ? courtNameById.get(m.court_id) ?? null : null,
  }));

  const bracketDisplayMatches: BracketDisplayMatch[] = (bracketMatches ?? []).map((m: Match) => ({
    ...m,
    team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
    team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
  }));

  const colors = disciplineColor(competition.disciplines);
  const isLive = LIVE_STATUSES.includes(competition.status);
  const disciplineCategory = `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`;

  const liveMatches: LiveMatchInfo[] = [
    ...groupMatchDisplays
      .filter((m) => m.status === "in_progress")
      .map((m) => ({
        matchId: m.id,
        disciplineCategory,
        dotClass: colors.dot,
        teamAName: m.team_a_name,
        teamBName: m.team_b_name,
        courtName: m.court_name,
        startedAt: m.started_at,
      })),
    ...bracketDisplayMatches
      .filter((m) => m.status === "in_progress")
      .map((m) => ({
        matchId: m.id,
        disciplineCategory,
        dotClass: colors.dot,
        teamAName: m.team_a_name ?? "?",
        teamBName: m.team_b_name ?? "?",
        courtName: m.court_id ? courtNameById.get(m.court_id) ?? null : null,
        startedAt: m.started_at,
      })),
  ];

  const content = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{disciplineCategory}</h2>
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[competition.status]}`}
        >
          {competitionStatusLabel[competition.status]}
        </span>
      </div>

      {groupMatchDisplays.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold panel-label uppercase tracking-wide">
            Partidos de fase de grupos
          </h3>
          <PublicMatchList matches={groupMatchDisplays} />
        </section>
      )}

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

      {standingsByGroup.length === 0 && bracketDisplayMatches.length === 0 && groupMatchDisplays.length === 0 && (
        <p className="text-sm panel-label">Todavía no hay grupos ni resultados cargados.</p>
      )}
    </div>
  );

  return {
    tabItem: {
      id: competition.id,
      label: disciplineCategory,
      dotClass: colors.dot,
      isLive,
      content,
    },
    liveMatches,
  };
}
