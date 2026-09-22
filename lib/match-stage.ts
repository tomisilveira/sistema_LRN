// Qué instancia del torneo es un partido — "Grupo A", "Cuartos de final",
// "Semifinal", "3er puesto", "Final" — para mostrarlo en las canchas en
// vivo, la pantalla, el juez y el fixture público. Lógica pura (sirve en
// server y cliente).
import type { Match } from "./database.types";

export type MatchStageTone = "group" | "bracket" | "third" | "final";

export interface MatchStage {
  label: string;
  tone: MatchStageTone;
}

/** Nombre legible de una ronda del cuadro ('F', 'SF', 'QF', '3P'...). */
export function roundName(code: string): string {
  switch (code) {
    case "F":
      return "Final";
    case "SF":
      return "Semifinal";
    case "QF":
      return "Cuartos de final";
    case "R16":
      return "Octavos de final";
    case "R32":
      return "Dieciseisavos de final";
    case "3P":
      return "3er puesto";
    default:
      return code;
  }
}

/** `groupName` es el nombre del grupo del partido (si es de fase de
 * grupos); `goldSilver` = el torneo tiene dos cuadros (oro/plata), así que
 * hay que decir de cuál es — si no, hay dos "Final". */
export function matchStage(
  match: Pick<Match, "phase" | "round" | "bracket_type">,
  { groupName, goldSilver = false }: { groupName?: string | null; goldSilver?: boolean } = {}
): MatchStage {
  if (match.phase === "group") {
    const group = groupName?.trim();
    if (!group) return { label: "Fase de grupos", tone: "group" };
    // Los grupos se crean como "Grupo A", pero se pueden renombrar a "A".
    return { label: /^(grupo|zona)\b/i.test(group) ? group : `Grupo ${group}`, tone: "group" };
  }

  const round = match.round ?? "";
  const cup = goldSilver ? (match.bracket_type === "silver" ? "Copa Plata · " : "Copa Oro · ") : "";
  if (round === "F") return { label: `${cup}Final`, tone: "final" };
  if (round === "3P") return { label: `${cup}Por el 3er puesto`, tone: "third" };
  return { label: `${cup}${round ? roundName(round) : "Fase final"}`, tone: "bracket" };
}
