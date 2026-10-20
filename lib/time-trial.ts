// Lógica pura (sin DB) de la contrarreloj — seguidor de línea, format_type
// 'time_trial' (ver supabase/migrations/0019_time_trial.sql). La usan el
// juez, el panel admin, la vista pública, el podio y el Excel.
//
// Reglas (oct 2026): cada robot corre hasta `periods_count` intentos de
// hasta `period_seconds`; vale el MEJOR tiempo, desempata el segundo mejor
// (y así), después quien tiene más intentos terminados. Un robot sin ningún
// intento terminado queda al final ("sin tiempo").

import type { Team, TimeTrialRun } from "./database.types";

export interface TimeTrialRankingRow {
  team: Team;
  /** Intentos cargados, ordenados por número de intento. */
  runs: TimeTrialRun[];
  /** Tiempos terminados de menor a mayor (ms). */
  times: number[];
  bestMs: number | null;
  attemptsUsed: number;
  /** Puesto (1, 2, 3...). null = todavía sin tiempo válido. Empates
   * exactos comparten puesto. */
  position: number | null;
}

function compareTimes(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1; // menos tiempos terminados → detrás
    if (y === undefined) return -1;
    if (x !== y) return x - y;
  }
  return 0;
}

/** Ranking de la contrarreloj: todos los equipos del torneo, con o sin
 * intentos. Los sin tiempo van al final, por orden alfabético. */
export function buildTimeTrialRanking(teams: Team[], runs: TimeTrialRun[]): TimeTrialRankingRow[] {
  const runsByTeam = new Map<string, TimeTrialRun[]>();
  for (const r of runs) {
    const list = runsByTeam.get(r.team_id) ?? [];
    list.push(r);
    runsByTeam.set(r.team_id, list);
  }

  const rows: TimeTrialRankingRow[] = teams.map((team) => {
    const teamRuns = (runsByTeam.get(team.id) ?? []).sort((a, b) => a.attempt - b.attempt);
    const times = teamRuns
      .filter((r) => r.finished && r.time_ms !== null)
      .map((r) => r.time_ms as number)
      .sort((a, b) => a - b);
    return {
      team,
      runs: teamRuns,
      times,
      bestMs: times[0] ?? null,
      attemptsUsed: teamRuns.length,
      position: null,
    };
  });

  rows.sort((a, b) => {
    if (a.bestMs === null && b.bestMs === null) return a.team.name.localeCompare(b.team.name);
    if (a.bestMs === null) return 1;
    if (b.bestMs === null) return -1;
    return compareTimes(a.times, b.times) || a.team.name.localeCompare(b.team.name);
  });

  let lastPos = 0;
  rows.forEach((row, i) => {
    if (row.bestMs === null) return;
    const prev = rows[i - 1];
    row.position = prev && prev.bestMs !== null && compareTimes(prev.times, row.times) === 0 ? lastPos : i + 1;
    lastPos = row.position;
  });

  return rows;
}

/** 83456 → "1:23.45" · 9870 → "9.87" (centésimas, como un cronómetro). */
export function formatRunTime(ms: number | null): string {
  if (ms === null) return "—";
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const csStr = String(cs).padStart(2, "0");
  return min > 0 ? `${min}:${String(sec).padStart(2, "0")}.${csStr}` : `${sec}.${csStr}`;
}

/** Lo que escribe el juez a mano → ms. Acepta "1:23.45", "83.45",
 * "83,45", "83". null si no se entiende o es 0. */
export function parseRunTime(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const m = /^(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) return null;
  const min = m[1] ? Number(m[1]) : 0;
  const sec = Number(m[2]);
  if (m[1] && sec >= 60) return null;
  const frac = m[3] ? Number(m[3].padEnd(3, "0")) : 0;
  const ms = (min * 60 + sec) * 1000 + frac;
  return ms > 0 ? ms : null;
}
