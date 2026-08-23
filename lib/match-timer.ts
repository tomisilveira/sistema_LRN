// Lógica pura del reloj pausable de período/ronda — la usan tanto los
// endpoints (server, para decidir remaining/pausado antes de escribir) como
// los componentes de cliente (juez y público, para hacer tick localmente sin
// pedirle un valor al servidor cada segundo). Ver plan y
// supabase/migrations/0006_match_timer.sql para el modelo de datos.

export interface MatchTimerState {
  status: string;
  timer_running_since: string | null;
  timer_elapsed_seconds: number;
  current_period: number;
}

export interface CompetitionTimerConfig {
  timer_mode: "periods" | "rounds";
  period_seconds: number | null;
  periods_count: number;
  rounds_to_win: number | null;
}

/** Segundos transcurridos del período/ronda actual a un instante dado
 * (por defecto, ahora). */
export function elapsedSeconds(match: MatchTimerState, at: number = Date.now()): number {
  const running = match.timer_running_since
    ? Math.max(0, (at - new Date(match.timer_running_since).getTime()) / 1000)
    : 0;
  // `?? 0`: defensivo contra filas viejas leídas antes de correr
  // 0006_match_timer.sql (la columna vendría undefined, no 0).
  return (match.timer_elapsed_seconds ?? 0) + running;
}

/** Segundos restantes del período/ronda actual — null si el torneo todavía
 * no tiene `period_seconds` configurado. Nunca negativo. */
export function remainingSeconds(
  match: MatchTimerState,
  competition: Pick<CompetitionTimerConfig, "period_seconds">,
  at: number = Date.now()
): number | null {
  // `== null`: cubre tanto `null` (torneo sin configurar) como `undefined`
  // (fila leída antes de correr 0006_match_timer.sql, la columna ni existe).
  if (competition.period_seconds == null) return null;
  return Math.max(0, competition.period_seconds - elapsedSeconds(match, at));
}

/** Pausado = el período arrancó (hay algo acumulado) pero no está corriendo
 * ahora mismo. Distinto de "todavía no arrancó este período" (elapsed=0 y
 * running=null, recién llegado a un período/ronda nuevo). */
export function isPaused(match: MatchTimerState): boolean {
  return match.status === "in_progress" && !match.timer_running_since && match.timer_elapsed_seconds > 0;
}

export function isRunning(match: MatchTimerState): boolean {
  return match.status === "in_progress" && !!match.timer_running_since;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Para el modo 'rounds' (sumo): cuántos rounds ganó cada equipo hasta ahora. */
export function roundWinCounts(
  roundWinnerIds: string[],
  teamAId: string | null,
  teamBId: string | null
): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const id of roundWinnerIds) {
    if (id === teamAId) a++;
    else if (id === teamBId) b++;
  }
  return { a, b };
}
