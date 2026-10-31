// Todos-contra-todos: cada equipo juega contra cada otro equipo del mismo
// grupo. Alcanza para el tamaño de grupos típico de la Liga (4-6 equipos);
// no arma un cronograma por rondas — cancha y turno los asigna
// lib/auto-schedule.ts.
export function generateRoundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

/** Máximo de vueltas que se puede configurar (mismo tope que la DB, 0022). */
export const MAX_ROUND_ROBIN_LEGS = 6;

/** Vueltas configuradas en el torneo (1 si no hay dato: torneo viejo o
 * migración 0022 sin aplicar). */
export function roundRobinLegsOf(competition: { round_robin_legs?: number | null }): number {
  const legs = competition.round_robin_legs ?? 1;
  return Number.isInteger(legs) && legs >= 1 ? Math.min(legs, MAX_ROUND_ROBIN_LEGS) : 1;
}

/** Todos contra todos armado por RONDAS (método del círculo): en cada ronda
 * cada equipo juega como mucho una vez (con cantidad impar, uno descansa
 * por ronda). Así, jugando las rondas en orden, ningún equipo juega todos
 * sus partidos seguidos al principio y después queda parado. */
export function roundRobinRounds(teamIds: string[]): [string, string][][] {
  if (teamIds.length < 2) return [];
  const BYE = "__libre__"; // lugar vacío con cantidad impar (no es un id real)
  const ids = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = ids.length;
  const rounds: [string, string][][] = [];
  let arr = ids;
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      // Alterna quién figura primero para que el fijo no sea siempre "local".
      round.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

/** Rondas de las `legs` vueltas: primero todas las rondas de la vuelta 1,
 * después las de la 2, etc., invirtiendo los lados en las vueltas pares. */
export function roundRobinLegRounds(teamIds: string[], legs: number): [string, string][][] {
  const base = roundRobinRounds(teamIds);
  const result: [string, string][][] = [];
  for (let leg = 0; leg < legs; leg++) {
    for (const round of base) result.push(leg % 2 === 0 ? round.map(([a, b]) => [a, b]) : round.map(([a, b]) => [b, a]));
  }
  return result;
}

/** Todos contra todos con `legs` vueltas, en orden de juego (por rondas). */
export function generateRoundRobinLegs(teamIds: string[], legs: number): [string, string][] {
  return roundRobinLegRounds(teamIds, legs).flat();
}

/** Mezcla las rondas de varios grupos: ronda 1 de cada grupo, después la
 * ronda 2 de cada grupo, etc. — los grupos avanzan a la par. */
export function interleaveRounds<T>(roundsPerGroup: T[][][]): T[] {
  const result: T[] = [];
  const maxRounds = Math.max(0, ...roundsPerGroup.map((r) => r.length));
  for (let r = 0; r < maxRounds; r++) {
    for (const rounds of roundsPerGroup) if (r < rounds.length) result.push(...rounds[r]);
  }
  return result;
}

/** Partidos que faltan para completar `legs` vueltas, dados los partidos que
 * ya existen en el grupo (para "Armar partidos que falten"): por cada par,
 * los que le faltan, en orden de rondas. */
export function missingRoundRobinMatches(
  teamIds: string[],
  legs: number,
  existing: { team_a_id: string | null; team_b_id: string | null }[]
): [string, string][] {
  const key = (a: string, b: string) => [a, b].sort().join("::");
  const played = new Map<string, number>();
  for (const m of existing) {
    if (!m.team_a_id || !m.team_b_id) continue;
    const k = key(m.team_a_id, m.team_b_id);
    played.set(k, (played.get(k) ?? 0) + 1);
  }
  // Ocurrencia N de un par en el orden de juego = su vuelta N.
  const seen = new Map<string, number>();
  const missing: [string, string][] = [];
  for (const [a, b] of generateRoundRobinLegs(teamIds, legs)) {
    const k = key(a, b);
    const leg = seen.get(k) ?? 0;
    seen.set(k, leg + 1);
    if ((played.get(k) ?? 0) > leg) continue; // esta vuelta de este par ya existe
    missing.push([a, b]);
  }
  return missing;
}
