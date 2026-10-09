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

// ---------------------------------------------------------------------------
// Redistribución equilibrada (botón "Redistribuir canchas")
// ---------------------------------------------------------------------------
// autoScheduleMatches agenda UN torneo por vez, siempre arrancando del
// turno 1: dos torneos de la misma disciplina que comparten canchas se
// apilan en las mismas, y si una cancha se agregó después queda vacía.
// Esto vuelve a repartir de una TODOS los partidos sin jugar de un grupo de
// canchas, mezclando los torneos para que avancen a la par.

export interface RebalanceMatch extends SchedulableMatch {
  /** Torneo + copa (oro/plata/única): la cadena de dependencias. */
  chain: string;
  /** Torneo solo: la fase de grupos de un torneo bloquea todas sus copas. */
  competitionId: string;
  /** 0 = fase de grupos; después, rondas del cuadro en orden de juego. */
  stage: number;
}

/** Orden de juego de las rondas del cuadro (la final, última: espera al 3er
 * puesto). Igual que en generateBracketForCompetition. */
export function bracketStage(round: string | null): number {
  return 1 + (({ R32: 0, R16: 1, QF: 2, SF: 3, "3P": 4, F: 5 } as Record<string, number>)[round ?? ""] ?? 3);
}

/**
 * Reparte `matches` (ya ordenados dentro de cada torneo) entre `courts`,
 * desde `startTurno`:
 * - Intercala los torneos: toma un partido de cada uno por vez, así ninguno
 *   espera a que otro termine.
 * - Cada partido va a la cancha+turno más temprana donde sus equipos estén
 *   libres; ante empate, a la cancha con menos partidos (equilibrio).
 * - Una ronda de cuadro nunca queda antes (ni a la par) que la ronda o la
 *   fase de grupos de la que depende.
 */
export function rebalanceSchedule(
  matches: RebalanceMatch[],
  courts: CourtOption[],
  startTurno: number
): ScheduleAssignment[] {
  if (courts.length === 0 || matches.length === 0) return [];

  // Intercalado por torneo, respetando el orden recibido dentro de cada uno.
  const queues = new Map<string, RebalanceMatch[]>();
  for (const m of matches) {
    const q = queues.get(m.competitionId) ?? [];
    q.push(m);
    queues.set(m.competitionId, q);
  }
  const ordered: RebalanceMatch[] = [];
  const lists = [...queues.values()];
  for (let i = 0; ordered.length < matches.length; i++) {
    for (const q of lists) if (i < q.length) ordered.push(q[i]);
  }

  const courtNext = new Map(courts.map((c) => [c.id, startTurno]));
  const courtLoad = new Map(courts.map((c) => [c.id, 0]));
  const teamBusy = new Map<string, Set<number>>();
  // Último turno usado por etapa: clave `${cadena}|${etapa}` y, para la
  // fase de grupos, `${torneo}|0` (bloquea a todas las copas del torneo).
  const lastTurno = new Map<string, number>();

  const free = (team: string | null, t: number) => !team || !teamBusy.get(team)?.has(t);
  const busy = (team: string | null, t: number) => {
    if (!team) return;
    if (!teamBusy.has(team)) teamBusy.set(team, new Set());
    teamBusy.get(team)!.add(t);
  };
  const minTurnoFor = (m: RebalanceMatch) => {
    if (m.stage === 0) return startTurno;
    let min = (lastTurno.get(`${m.competitionId}|0`) ?? startTurno - 1) + 1;
    for (let s = 1; s < m.stage; s++) {
      const t = lastTurno.get(`${m.chain}|${s}`);
      if (t !== undefined) min = Math.max(min, t + 1);
    }
    return Math.max(min, startTurno);
  };

  const result: ScheduleAssignment[] = [];
  for (const m of ordered) {
    const min = minTurnoFor(m);
    let best: { courtId: string; turno: number; load: number } | null = null;
    for (const c of courts) {
      let t = Math.max(courtNext.get(c.id)!, min);
      while (!free(m.team_a_id, t) || !free(m.team_b_id, t)) t++;
      const load = courtLoad.get(c.id)!;
      if (!best || t < best.turno || (t === best.turno && load < best.load)) {
        best = { courtId: c.id, turno: t, load };
      }
    }
    if (!best) continue;
    result.push({ matchId: m.id, courtId: best.courtId, turno: best.turno });
    courtNext.set(best.courtId, best.turno + 1);
    courtLoad.set(best.courtId, best.load + 1);
    busy(m.team_a_id, best.turno);
    busy(m.team_b_id, best.turno);
    const key = m.stage === 0 ? `${m.competitionId}|0` : `${m.chain}|${m.stage}`;
    lastTurno.set(key, Math.max(lastTurno.get(key) ?? 0, best.turno));
  }
  return result;
}
