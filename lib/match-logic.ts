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
   * Para disciplinas sin marcador (sumo): id del equipo ganador elegido
   * directamente por el juez. Si viene definido, tiene prioridad sobre
   * scoreA/scoreB.
   */
  winnerIdIfNoScore?: string | null;
}

export interface MatchOutcome {
  winner_id: string | null; // null = empate
  status: "completed";
}

export function computeMatchOutcome(input: MatchOutcomeInput): MatchOutcome {
  const { allowDraws, teamAId, teamBId, scoreA, scoreB, winnerIdIfNoScore } = input;

  if (winnerIdIfNoScore) {
    if (winnerIdIfNoScore !== teamAId && winnerIdIfNoScore !== teamBId) {
      throw new Error("El ganador elegido no pertenece a este partido.");
    }
    return { winner_id: winnerIdIfNoScore, status: "completed" };
  }

  if (scoreA === null || scoreB === null) {
    throw new Error("Falta cargar el marcador de ambos equipos.");
  }
  if (scoreA < 0 || scoreB < 0) {
    throw new Error("El marcador no puede ser negativo.");
  }
  if (scoreA === scoreB) {
    if (!allowDraws) {
      throw new Error("Esta disciplina no admite empates: hay que definir un ganador.");
    }
    return { winner_id: null, status: "completed" };
  }
  return { winner_id: scoreA > scoreB ? teamAId : teamBId, status: "completed" };
}
