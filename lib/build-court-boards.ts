import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match, Team } from "./database.types";
import type { CompetitionWithNames } from "./build-event-tab-items";
import { disciplineColor } from "./discipline-colors";

export interface CourtBoardMatch {
  match: Match;
  competition: CompetitionWithNames;
  teamAName: string;
  teamBName: string;
  disciplineCategory: string;
}

export interface CourtBoard {
  courtId: string;
  courtName: string;
  colorDot: string;
  colorBorder: string;
  colorBg: string;
  live: CourtBoardMatch | null;
  upcoming: CourtBoardMatch[];
}

/** Arma la vista "una tarjeta por cancha" de la pantalla pública: el
 * partido en curso de cada cancha (con su reloj) + los próximos, agrupando
 * por `court_id` en vez de por torneo/disciplina — reusa las mismas
 * competitions ya cargadas para el switcher de disciplinas
 * (buildEventTabItems), así no se duplica esa consulta. */
export async function buildCourtBoards(
  supabase: SupabaseClient,
  eventId: string,
  competitions: CompetitionWithNames[]
): Promise<CourtBoard[]> {
  const { data: courts } = await supabase
    .from("courts_public")
    .select("id, name, sort_order, discipline_id")
    .eq("event_id", eventId)
    .order("sort_order");
  const courtsList = (courts ?? []) as { id: string; name: string; sort_order: number; discipline_id: string | null }[];
  if (courtsList.length === 0) return [];

  const competitionIds = competitions.map((c) => c.id);
  const competitionById = new Map(competitions.map((c) => [c.id, c]));

  const { data: matches } = competitionIds.length
    ? await supabase
        .from("matches")
        .select("*")
        .in("competition_id", competitionIds)
        .in("status", ["scheduled", "in_progress"])
        .order("turno", { ascending: true, nullsFirst: false })
    : { data: [] as Match[] };
  const matchList = (matches ?? []) as Match[];

  const teamIds = matchList.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x);
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const teamName = new Map((teams ?? []).map((t: Pick<Team, "id" | "name">) => [t.id, t.name]));

  const byCourt = new Map<string, Match[]>();
  for (const m of matchList) {
    if (!m.court_id) continue;
    const list = byCourt.get(m.court_id) ?? [];
    list.push(m);
    byCourt.set(m.court_id, list);
  }

  const toDisplay = (m: Match): CourtBoardMatch | null => {
    const competition = competitionById.get(m.competition_id);
    if (!competition) return null;
    return {
      match: m,
      competition,
      teamAName: teamName.get(m.team_a_id ?? "") ?? "?",
      teamBName: teamName.get(m.team_b_id ?? "") ?? "?",
      disciplineCategory: `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`,
    };
  };

  return courtsList
    .map((court) => {
      const courtMatches = byCourt.get(court.id) ?? [];
      const liveMatch = courtMatches.find((m) => m.status === "in_progress");
      const upcoming = courtMatches.filter((m) => m.status === "scheduled").slice(0, 3);
      const colors = disciplineColor(
        court.discipline_id
          ? (competitions.find((c) => c.discipline_id === court.discipline_id)?.disciplines ?? null)
          : null
      );
      return {
        courtId: court.id,
        courtName: court.name,
        colorDot: colors.dot,
        colorBorder: colors.border,
        colorBg: colors.bg,
        live: liveMatch ? toDisplay(liveMatch) : null,
        upcoming: upcoming.map(toDisplay).filter((x): x is CourtBoardMatch => !!x),
      };
    })
    .filter((board) => board.live || board.upcoming.length > 0);
}
