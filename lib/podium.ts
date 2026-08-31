// Lógica pura (sin DB) para armar el podio de un torneo a partir de los
// datos que la página del torneo ya tiene cargados. Ver
// app/admin/(protected)/competencias/[competitionId]/podium-panel.tsx para
// el render.

import { parseMemberNames } from "./team-display";
import type { Competition, Group, GroupStandingRow, Match, Team } from "./database.types";

export interface PodiumEntry {
  position: 1 | 2 | 3;
  team: Team;
  participantNames: string[];
  participantCount: number;
}

export interface PodiumBoard {
  label: string;
  /** Entradas del podio (0 a 3). El 3er puesto sólo aparece si se jugó. */
  entries: PodiumEntry[];
  /** Aclaración: por qué no hay podio, o que falta jugar el 3er puesto. */
  note?: string;
}

export interface BuildPodiumInput {
  competition: Pick<Competition, "format_type" | "status">;
  teams: Team[];
  groups: Group[];
  standingsByGroup: { group: Group; rows: GroupStandingRow[] }[];
  bracketMatches: Match[];
}

function cleanName(raw: string): string {
  // "Fulano (12)" → "Fulano" — la edad se guarda entre paréntesis al final
  // (ver MemberListInput). Cualquier otra cosa entra tal cual.
  return raw.replace(/\s*\(\d{1,2}\)\s*$/, "").trim();
}

function toEntry(position: 1 | 2 | 3, team: Team): PodiumEntry {
  const participantNames = parseMemberNames(team.member_names).map(cleanName).filter(Boolean);
  const participantCount = team.participants_present ?? team.member_count ?? participantNames.length;
  return { position, team, participantNames, participantCount };
}

/** Podio de un cuadro de eliminación (un `bracket_type` puntual): 1º/2º de la
 * final, 3º del partido por el 3er puesto. Si ese partido todavía no se
 * jugó (o no existe), NO se inventa un 3º — se deja una nota. */
function bracketBoard(label: string, matches: Match[], teamsById: Map<string, Team>): PodiumBoard {
  const final = matches.find((m) => m.round === "F");
  const third = matches.find((m) => m.round === "3P");
  const semis = matches.filter((m) => m.round === "SF");

  const entries: PodiumEntry[] = [];
  let note: string | undefined;

  if (final && final.status === "completed" && final.winner_id) {
    const champ = teamsById.get(final.winner_id);
    const runnerUpId = final.winner_id === final.team_a_id ? final.team_b_id : final.team_a_id;
    const runnerUp = runnerUpId ? teamsById.get(runnerUpId) : null;
    if (champ) entries.push(toEntry(1, champ));
    if (runnerUp) entries.push(toEntry(2, runnerUp));
  } else {
    note = "El cuadro todavía no terminó — falta jugar la final.";
  }

  if (third && third.status === "completed" && third.winner_id) {
    const t = teamsById.get(third.winner_id);
    if (t) entries.push(toEntry(3, t));
  } else {
    // 3er puesto sin definir: nombramos a los dos que lo disputan, sin
    // ponerlos a ambos como "tercero".
    const semiLosers = semis
      .filter((s) => s.status === "completed" && s.winner_id && s.team_a_id && s.team_b_id)
      .map((s) => teamsById.get(s.winner_id === s.team_a_id ? (s.team_b_id as string) : (s.team_a_id as string)))
      .filter((t): t is Team => !!t);

    if (semiLosers.length === 2) {
      const names = `${semiLosers[0].name} y ${semiLosers[1].name}`;
      note = third
        ? `El 3er puesto se define en el partido entre ${names} (todavía sin jugar).`
        : `Falta el partido por el 3er puesto entre ${names} — generalo con el botón de la pestaña del cuadro.`;
    } else if (!note) {
      note = "El 3er puesto se define cuando terminen las dos semifinales.";
    }
  }

  return { label, entries, note };
}

export function buildPodium({
  competition,
  teams,
  groups,
  standingsByGroup,
  bracketMatches,
}: BuildPodiumInput): PodiumBoard[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  if (competition.format_type === "gold_silver") {
    return [
      bracketBoard("🥇 Copa Oro", bracketMatches.filter((m) => m.bracket_type === "gold"), teamsById),
      bracketBoard("🥈 Copa Plata", bracketMatches.filter((m) => m.bracket_type === "silver"), teamsById),
    ];
  }

  if (competition.format_type === "single_elimination" || competition.format_type === "bracket_only") {
    return [bracketBoard("Podio", bracketMatches.filter((m) => m.bracket_type === null), teamsById)];
  }

  // groups_only: sólo hay podio si el torneo tiene UN solo grupo (decisión
  // explícita — con varios grupos y sin fase final no hay ranking único).
  if (groups.length === 1 && standingsByGroup.length === 1) {
    const rows = standingsByGroup[0].rows.slice(0, 3);
    const entries: PodiumEntry[] = rows
      .map((r, i) => {
        const team = teamsById.get(r.team_id);
        return team ? toEntry((i + 1) as 1 | 2 | 3, team) : null;
      })
      .filter((e): e is PodiumEntry => e !== null);
    return [{ label: "Podio", entries }];
  }

  return [
    {
      label: "Podio",
      entries: [],
      note:
        "Este torneo es sólo fase de grupos y tiene más de un grupo, así que no hay un podio único. Mirá las posiciones de cada grupo en la pestaña Posiciones (o generá una fase final).",
    },
  ];
}
