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

/** Todos contra todos con `legs` vueltas: cada par se enfrenta `legs` veces.
 * Primero va la vuelta 1 completa, después la 2, etc. (así el auto-schedule
 * reparte las vueltas en orden y nadie juega dos veces seguidas contra el
 * mismo), alternando quién figura primero en cada vuelta. */
export function generateRoundRobinLegs(teamIds: string[], legs: number): [string, string][] {
  const pairs = generateRoundRobinPairs(teamIds);
  const result: [string, string][] = [];
  for (let leg = 0; leg < legs; leg++) {
    for (const [a, b] of pairs) result.push(leg % 2 === 0 ? [a, b] : [b, a]);
  }
  return result;
}

/** Partidos que faltan para completar `legs` vueltas, dados los partidos que
 * ya existen en el grupo (para "Armar partidos que falten"): por cada par,
 * los que le faltan, siguiendo la misma alternancia de lados. */
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
  const missing: [string, string][] = [];
  for (let leg = 0; leg < legs; leg++) {
    for (const [a, b] of generateRoundRobinPairs(teamIds)) {
      const k = key(a, b);
      const have = played.get(k) ?? 0;
      if (have > leg) continue; // esta vuelta de este par ya existe
      played.set(k, have + 1);
      missing.push(leg % 2 === 0 ? [a, b] : [b, a]);
    }
  }
  return missing;
}
