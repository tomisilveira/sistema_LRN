// Lógica pura (sin DB) para armar la fase de eliminatoria simple a partir
// de la tabla de posiciones de los grupos. Ver lib/bracket-actions.ts para
// la parte que persiste esto en Supabase.

export interface SeedTeam {
  teamId: string;
  teamName: string;
  seed: number; // 1 = mejor semilla
}

export interface BracketSlot {
  slot: number; // posición dentro de la ronda, 0-indexed
  teamAId: string | null;
  teamBId: string | null;
  /** true si esta posición es un "bye" (un solo equipo, avanza directo) */
  isBye: boolean;
}

export interface BracketRound {
  round: string; // 'F' | 'SF' | 'QF' | 'R16' | 'R32' | ...
  matches: BracketSlot[];
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Orden de semillas estándar de un cuadro de eliminación directa
 * (1 vs N, 2 vs N-1, ... pero agrupado para que las semillas altas
 * se enfrenten recién en rondas avanzadas). Ej para n=8: [1,8,4,5,2,7,3,6].
 */
function seedingOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedingOrder(n / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(n + 1 - s);
  }
  return result;
}

export function roundLabel(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return "F";
    case 2:
      return "SF";
    case 4:
      return "QF";
    case 8:
      return "R16";
    case 16:
      return "R32";
    default:
      return `R${matchesInRound * 2}`;
  }
}

/**
 * Intercala los clasificados de cada grupo por posición (todos los 1eros,
 * luego todos los 2dos, ...) para minimizar cruces entre equipos del mismo
 * grupo en las primeras rondas, y les asigna número de semilla 1..N.
 */
export function buildSeedOrder(
  qualifiersByGroup: { groupName: string; teams: { teamId: string; teamName: string; rank: number }[] }[]
): SeedTeam[] {
  const maxRank = Math.max(0, ...qualifiersByGroup.map((g) => g.teams.length));
  const seeds: SeedTeam[] = [];
  for (let r = 1; r <= maxRank; r++) {
    for (const g of qualifiersByGroup) {
      const t = g.teams.find((t) => t.rank === r);
      if (t) seeds.push({ teamId: t.teamId, teamName: t.teamName, seed: 0 });
    }
  }
  return seeds.map((s, i) => ({ ...s, seed: i + 1 }));
}

/**
 * Genera todas las rondas del cuadro de eliminación directa, desde la
 * primera ronda (puede incluir byes si la cantidad de clasificados no es
 * potencia de 2) hasta la final. Las rondas 2+ arrancan con ambos equipos
 * en null: se completan por avance automático de ganadores.
 */
export function generateBracketRounds(seedTeams: SeedTeam[]): BracketRound[] {
  if (seedTeams.length < 2) {
    throw new Error("Se necesitan al menos 2 equipos clasificados para armar un cuadro.");
  }

  const size = nextPowerOfTwo(seedTeams.length);
  const order = seedingOrder(size);
  const bySeed = new Map(seedTeams.map((t) => [t.seed, t]));

  const round1: BracketSlot[] = [];
  for (let i = 0; i < size; i += 2) {
    const teamA = bySeed.get(order[i]) ?? null;
    const teamB = bySeed.get(order[i + 1]) ?? null;
    round1.push({
      slot: i / 2,
      teamAId: teamA?.teamId ?? null,
      teamBId: teamB?.teamId ?? null,
      isBye: !teamA || !teamB,
    });
  }

  const rounds: BracketRound[] = [{ round: roundLabel(round1.length), matches: round1 }];
  let matchesInRound = round1.length;
  while (matchesInRound > 1) {
    matchesInRound = matchesInRound / 2;
    rounds.push({
      round: roundLabel(matchesInRound),
      matches: Array.from({ length: matchesInRound }, (_, i) => ({
        slot: i,
        teamAId: null,
        teamBId: null,
        isBye: false,
      })),
    });
  }
  return rounds;
}
