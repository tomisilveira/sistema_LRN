// Lógica pura para decidir el resultado de un partido/combate. La usan tanto
// el panel admin como el endpoint que recibe la carga del juez de cancha.

export interface MatchOutcomeInput {
  allowDraws: boolean;
  teamAId: string;
  teamBId: string;
  /** Marcador numérico (fútbol). Null si la disciplina no usa marcador. */
  scoreA: number | null;
  scoreB: number | null;
  /**
   * Ganador elegido a mano: en disciplinas sin marcador (sumo) es el
   * resultado directo; con marcador empatado es quien ganó por penales.
   * Si el marcador ya define un ganador, tiene que coincidir con él.
   */
  winnerIdIfNoScore?: string | null;
  /** Partido de la fase final (cuadro): no puede terminar empatado — un
   * empate se define por penales (oct 2026: antes quedaba sin ganador y el
   * cuadro se trababa, porque nadie avanzaba a la ronda siguiente). */
  knockout?: boolean;
}

export interface MatchOutcome {
  winner_id: string | null; // null = empate
  status: "completed";
}

export function computeMatchOutcome(input: MatchOutcomeInput): MatchOutcome {
  const { allowDraws, teamAId, teamBId, scoreA, scoreB, winnerIdIfNoScore, knockout = false } = input;

  if (winnerIdIfNoScore && winnerIdIfNoScore !== teamAId && winnerIdIfNoScore !== teamBId) {
    throw new Error("El ganador elegido no pertenece a este partido.");
  }

  if (scoreA === null || scoreB === null) {
    if (winnerIdIfNoScore) return { winner_id: winnerIdIfNoScore, status: "completed" };
    throw new Error("Falta cargar el marcador de ambos equipos.");
  }
  if (scoreA < 0 || scoreB < 0) {
    throw new Error("El marcador no puede ser negativo.");
  }

  if (scoreA !== scoreB) {
    const byScore = scoreA > scoreB ? teamAId : teamBId;
    if (winnerIdIfNoScore && winnerIdIfNoScore !== byScore) {
      throw new Error("El ganador elegido no coincide con el marcador.");
    }
    return { winner_id: byScore, status: "completed" };
  }

  // Empate en el marcador: si se eligió ganador, ganó por penales.
  if (winnerIdIfNoScore) return { winner_id: winnerIdIfNoScore, status: "completed" };
  if (knockout) {
    throw new Error("En la fase final no puede haber empate: elegí quién ganó por penales.");
  }
  if (!allowDraws) {
    throw new Error("Esta disciplina no admite empates: hay que definir un ganador.");
  }
  return { winner_id: null, status: "completed" };
}
