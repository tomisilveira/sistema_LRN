import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketType, Group, GroupStandingRow, Match, Team } from "./database.types";
import type { CompetitionWithNames } from "./build-event-tab-items";
import type { BracketDisplayMatch } from "@/app/components/public-bracket-view";
import { disciplineColor } from "./discipline-colors";

export interface PantallaBracketBoard {
  bracketType: BracketType | null;
  label: string;
  matches: BracketDisplayMatch[];
}

export interface PantallaCompetitionBoard {
  competitionId: string;
  title: string; // "Fútbol Robótico — Infantil"
  dotClass: string;
  /** 'groups': todavía en fase de grupos (o sin resultados), se muestra la
   * tabla de posiciones. 'bracket': ya hay cuadro generado, se muestra el
   * cuadro en vez de la tabla. */
  phase: "groups" | "bracket";
  standings: { groupName: string; rows: GroupStandingRow[] }[];
  brackets: PantallaBracketBoard[];
}

const BRACKET_LABELS: Record<string, string> = {
  gold: "🥇 Copa Oro",
  silver: "🥈 Copa Plata",
};

/** Arma, por cada torneo del evento, la tarjeta que la pantalla pública
 * muestra cuando no hay ningún partido en vivo: tabla de posiciones si
 * todavía está en fase de grupos, o el cuadro (uno o dos, oro/plata en
 * 'gold_silver') si ya pasó a fase final. Mismo patrón de fetch que
 * lib/build-event-tab-items.tsx (RPC get_group_standings + matches por
 * fase), pero devuelve datos crudos en vez de JSX ya armado — la pantalla
 * necesita su propio layout "hero" para leerse de lejos. Competencias sin
 * grupos ni partidos de cuadro todavía (recién creadas) se omiten. */
export async function buildPantallaFallback(
  supabase: SupabaseClient,
  eventId: string,
  competitions: CompetitionWithNames[]
): Promise<PantallaCompetitionBoard[]> {
  const boards = await Promise.all(competitions.map((c) => buildOne(supabase, c)));
  return boards.filter((b): b is PantallaCompetitionBoard => b !== null);
}

async function buildOne(
  supabase: SupabaseClient,
  competition: CompetitionWithNames
): Promise<PantallaCompetitionBoard | null> {
  const [{ data: teams }, { data: groups }, { data: bracketMatches }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("competition_id", competition.id),
    supabase.from("groups").select("*").eq("competition_id", competition.id).order("sort_order"),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competition.id)
      .eq("phase", "bracket")
      .order("bracket_slot"),
  ]);

  const teamsById = new Map((teams ?? []).map((t: Pick<Team, "id" | "name">) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];
  const bracketMatchList = (bracketMatches ?? []) as Match[];

  const title = `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`;

  if (bracketMatchList.length > 0) {
    const toDisplay = (m: Match): BracketDisplayMatch => ({
      ...m,
      team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
      team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
    });

    const types = [...new Set(bracketMatchList.map((m) => m.bracket_type))];
    const brackets: PantallaBracketBoard[] = types.map((bracketType) => ({
      bracketType,
      label: bracketType ? (BRACKET_LABELS[bracketType] ?? bracketType) : "Cuadro",
      matches: bracketMatchList.filter((m) => m.bracket_type === bracketType).map(toDisplay),
    }));

    return {
      competitionId: competition.id,
      title,
      dotClass: disciplineColor(competition.disciplines).dot,
      phase: "bracket",
      standings: [],
      brackets,
    };
  }

  if (groupsList.length === 0) return null;

  const standings = await Promise.all(
    groupsList.map(async (g) => {
      try {
        const { data, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
        if (error) throw error;
        return { groupName: g.name, rows: (data ?? []) as GroupStandingRow[] };
      } catch (err) {
        console.error(`get_group_standings falló para el grupo ${g.id}:`, err);
        return { groupName: g.name, rows: [] as GroupStandingRow[] };
      }
    })
  );

  return {
    competitionId: competition.id,
    title,
    dotClass: "bg-brand-teal",
    phase: "groups",
    standings,
    brackets: [],
  };
}
