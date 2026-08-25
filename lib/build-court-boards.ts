import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match, MatchCard, Team } from "./database.types";
import type { CompetitionWithNames } from "./build-event-tab-items";
import { disciplineColor } from "./discipline-colors";
import { courtDisplayName } from "./court-display";

export interface CourtBoardMatch {
  match: Match;
  competition: CompetitionWithNames;
  teamAName: string;
  teamBName: string;
  teamAMemberNames: string | null;
  teamBMemberNames: string | null;
  cards: MatchCard[];
  disciplineCategory: string;
}

export interface CourtBoard {
  courtId: string;
  courtName: string;
  colorDot: string;
  colorBorder: string;
  colorBg: string;
  colorText: string;
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
    ? await supabase.from("teams").select("id, name, member_names").in("id", teamIds)
    : { data: [] as Pick<Team, "id" | "name" | "member_names">[] };
  const teamById = new Map((teams ?? []).map((t: Pick<Team, "id" | "name" | "member_names">) => [t.id, t]));

  const matchIds = matchList.map((m) => m.id);
  const { data: cardsData } = matchIds.length
    ? await supabase.from("match_cards").select("*").in("match_id", matchIds)
    : { data: [] as MatchCard[] };
  const cardsByMatchId = new Map<string, MatchCard[]>();
  for (const c of (cardsData ?? []) as MatchCard[]) {
    const list = cardsByMatchId.get(c.match_id) ?? [];
    list.push(c);
    cardsByMatchId.set(c.match_id, list);
  }

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
      teamAName: teamById.get(m.team_a_id ?? "")?.name ?? "?",
      teamBName: teamById.get(m.team_b_id ?? "")?.name ?? "?",
      teamAMemberNames: teamById.get(m.team_a_id ?? "")?.member_names ?? null,
      teamBMemberNames: teamById.get(m.team_b_id ?? "")?.member_names ?? null,
      cards: cardsByMatchId.get(m.id) ?? [],
      disciplineCategory: `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`,
    };
  };

  return courtsList
    .map((court) => {
      const courtMatches = byCourt.get(court.id) ?? [];
      const liveMatch = courtMatches.find((m) => m.status === "in_progress");
      const upcoming = courtMatches.filter((m) => m.status === "scheduled").slice(0, 3);
      const discipline = court.discipline_id
        ? (competitions.find((c) => c.discipline_id === court.discipline_id)?.disciplines ?? null)
        : null;
      const colors = disciplineColor(discipline);
      return {
        courtId: court.id,
        courtName: courtDisplayName(court.name, discipline),
        colorDot: colors.dot,
        colorBorder: colors.border,
        colorBg: colors.bg,
        colorText: colors.text,
        live: liveMatch ? toDisplay(liveMatch) : null,
        upcoming: upcoming.map(toDisplay).filter((x): x is CourtBoardMatch => !!x),
      };
    })
    .filter((board) => board.live || board.upcoming.length > 0);
}
