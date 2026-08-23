"use client";

import { useEffect, useState } from "react";
import type { Competition, Match } from "@/lib/database.types";
import { formatClock, isPaused, remainingSeconds, roundWinCounts } from "@/lib/match-timer";

export type MatchClockMatch = Pick<
  Match,
  "status" | "timer_running_since" | "timer_elapsed_seconds" | "current_period" | "round_winner_ids" | "team_a_id" | "team_b_id"
>;
export type MatchClockCompetition = Pick<Competition, "timer_mode" | "period_seconds" | "periods_count" | "rounds_to_win">;

/** El reloj de cuenta regresiva — firma visual del rediseño, reutilizado
 * igual en el panel del juez (hero, grande) y en la pantalla pública por
 * cancha (compact, chico). Tickea localmente cada segundo a partir del
 * snapshot que ya vino del server (timer_running_since/timer_elapsed_seconds);
 * no pide nada nuevo al servidor — cuando el estado realmente cambia (pausa,
 * siguiente round/período), la suscripción realtime de la pantalla ya trae
 * el `match` actualizado y este componente re-arranca solo. */
export function MatchClock({
  match,
  competition,
  size = "compact",
}: {
  match: MatchClockMatch;
  competition: MatchClockCompetition;
  size?: "hero" | "compact";
}) {
  // `now` arranca en null: calcularlo ya en el render inicial daría un
  // texto distinto entre el HTML del server y la primera pasada del
  // cliente (hydration mismatch) — recién se pisa con el valor real en el
  // efecto (solo cliente). Mientras tanto se muestra el tiempo completo del
  // período (sin restar nada), que es un placeholder válido y estable.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Recién acá es seguro leer el reloj real (solo cliente, después de que
    // hidrató con el placeholder) — mismo patrón que theme-toggle.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (competition.period_seconds == null) {
    return <p className="text-xs panel-label">Sin reloj configurado para este torneo.</p>;
  }

  const remaining = now === null ? competition.period_seconds : (remainingSeconds(match, competition, now) ?? 0);
  const paused = isPaused(match);
  const colorClass =
    paused || remaining <= 10
      ? "scoreboard-clock-red"
      : remaining <= 30
        ? "scoreboard-clock-orange"
        : "scoreboard-clock-teal";

  const showPeriodLabel = competition.timer_mode === "periods" && competition.periods_count > 1;
  const showRoundDots = competition.timer_mode === "rounds" && competition.rounds_to_win;

  return (
    <div className={`flex flex-col items-center ${size === "hero" ? "gap-2" : "gap-1"}`}>
      {showPeriodLabel && (
        <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
          Tiempo {match.current_period} de {competition.periods_count}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span
          className={`scoreboard-clock ${colorClass} ${size === "hero" ? "text-6xl sm:text-7xl" : "text-3xl"}`}
        >
          {formatClock(remaining)}
        </span>
        {paused && <span className="scoreboard-paused-badge">Pausado</span>}
      </div>
      {showRoundDots && (
        <div className="flex items-center gap-2 mt-1">
          {Array.from({ length: Math.max((match.round_winner_ids ?? []).length, 3) }, (_, i) => {
            const winner = match.round_winner_ids?.[i];
            const fill =
              winner === match.team_a_id ? "bg-brand-teal border-brand-teal" : winner === match.team_b_id ? "bg-brand-pink border-brand-pink" : "";
            return <span key={i} className={`scoreboard-round-dot ${fill}`} />;
          })}
          <span className="text-xs panel-label ml-1 font-mono">
            {(() => {
              const c = roundWinCounts(match.round_winner_ids ?? [], match.team_a_id, match.team_b_id);
              return `${c.a}–${c.b}`;
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
