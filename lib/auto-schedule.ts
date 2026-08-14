// Asignación automática de cancha + turno para una tanda de partidos —
// reemplaza tener que asignar cancha y turno a mano partido por partido.
// Algoritmo greedy: para cada partido (en el orden en que se generaron),
// prueba cada cancha disponible (rotando para repartir parejo) y elige la
// combinación cancha+turno más temprana posible en la que ni el equipo A
// ni el B ya estén jugando otro partido en ese turno. No es óptimo pero es
// simple, determinístico y evita choques de horario por construcción — no
// hace falta la validación de "choque de horario" que sí necesita la carga
// manual.

export interface SchedulableMatch {
  id: string;
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface CourtOption {
  id: string;
}

export interface ScheduleAssignment {
  matchId: string;
  courtId: string;
  turno: number;
}

export function autoScheduleMatches(
  matches: SchedulableMatch[],
  courts: CourtOption[]
): ScheduleAssignment[] {
  if (courts.length === 0 || matches.length === 0) return [];

  const courtNextTurno = new Map<string, number>(courts.map((c) => [c.id, 1]));
  const teamBusyTurnos = new Map<string, Set<number>>();

  function isTeamFree(teamId: string | null, turno: number) {
    if (!teamId) return true; // bracket sin equipos definidos todavía
    return !teamBusyTurnos.get(teamId)?.has(turno);
  }
  function markTeamBusy(teamId: string | null, turno: number) {
    if (!teamId) return;
    if (!teamBusyTurnos.has(teamId)) teamBusyTurnos.set(teamId, new Set());
    teamBusyTurnos.get(teamId)!.add(turno);
  }

  const assignments: ScheduleAssignment[] = [];
  let courtCursor = 0;

  for (const match of matches) {
    let bestCourtId: string | null = null;
    let bestTurno = Infinity;

    for (let i = 0; i < courts.length; i++) {
      const court = courts[(courtCursor + i) % courts.length];
      let turno = courtNextTurno.get(court.id)!;
      while (!isTeamFree(match.team_a_id, turno) || !isTeamFree(match.team_b_id, turno)) {
        turno++;
      }
      if (turno < bestTurno) {
        bestTurno = turno;
        bestCourtId = court.id;
      }
    }

    if (bestCourtId) {
      assignments.push({ matchId: match.id, courtId: bestCourtId, turno: bestTurno });
      courtNextTurno.set(bestCourtId, bestTurno + 1);
      markTeamBusy(match.team_a_id, bestTurno);
      markTeamBusy(match.team_b_id, bestTurno);
      courtCursor = (courtCursor + 1) % courts.length;
    }
  }

  return assignments;
}
