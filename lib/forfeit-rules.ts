// Reglas puras del W.O. (sin DB) — ver lib/forfeit.ts para aplicarlas.
//
// Decisiones (oct 2026, con la organización):
//   · Falta uno: gana el otro con marcador fijo, para que no beneficie ni
//     perjudique a quien le tocó enfrentarlo — fútbol 3–0; sumo/mini sumo
//     (rounds) rounds_to_win–0 (2–0 al mejor de 3).
//   · Faltan los dos: en grupos 0–0 y ninguno suma puntos (la tabla lo
//     cuenta como perdido para ambos, ver get_group_standings en 0020).
//     En la fase final no hay 0–0: nadie avanza desde ese cruce.

import type { Competition, ForfeitSide } from "./database.types";

export interface ForfeitResult {
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  round_winner_ids: string[];
}

/** Goles/rounds que se le dan al presente en un W.O. */
export function forfeitWinningScore(competition: Pick<Competition, "timer_mode" | "rounds_to_win">): number {
  return competition.timer_mode === "rounds" ? (competition.rounds_to_win ?? 2) : 3;
}

export function forfeitResult(
  competition: Pick<Competition, "timer_mode" | "rounds_to_win">,
  side: ForfeitSide,
  teamAId: string,
  teamBId: string,
  knockout: boolean
): ForfeitResult {
  if (side === "both") {
    return knockout
      ? { score_a: null, score_b: null, winner_id: null, round_winner_ids: [] }
      : { score_a: 0, score_b: 0, winner_id: null, round_winner_ids: [] };
  }
  const goals = forfeitWinningScore(competition);
  const winner = side === "a" ? teamBId : teamAId;
  return {
    score_a: side === "a" ? 0 : goals,
    score_b: side === "b" ? 0 : goals,
    winner_id: winner,
    round_winner_ids: competition.timer_mode === "rounds" ? Array<string>(goals).fill(winner) : [],
  };
}

/** Texto para mostrar el W.O. de un partido ("No se presentó X"). */
export function forfeitLabel(side: ForfeitSide | null, teamAName: string, teamBName: string): string | null {
  if (!side) return null;
  if (side === "both") return "No se presentó ninguno";
  return `No se presentó ${side === "a" ? teamAName : teamBName}`;
}
