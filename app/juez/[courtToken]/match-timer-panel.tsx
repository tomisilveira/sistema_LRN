"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Competition, Match } from "@/lib/database.types";
import { MatchClock } from "@/app/components/match-clock";
import { isPaused, isRunning } from "@/lib/match-timer";
import { ResultForm } from "./result-form";

/** Panel activo del partido en curso — el reloj (MatchClock) como hero,
 * más los controles según el modo de la disciplina: pausa/reanuda siempre;
 * en 'rounds' (sumo) dos botones grandes de "ganó este round"; en 'periods'
 * (fútbol) marcador en vivo + "terminar tiempo", y en el último tiempo se
 * abre el formulario de cierre de siempre (ResultForm, sin tocar su lógica). */
export function MatchTimerPanel({
  courtToken,
  match,
  competition,
  teamAName,
  teamBName,
}: {
  courtToken: string;
  match: Match;
  competition: Competition;
  teamAName: string;
  teamBName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveScoreA, setLiveScoreA] = useState(String(match.score_a ?? 0));
  const [liveScoreB, setLiveScoreB] = useState(String(match.score_b ?? 0));
  const [periodEnded, setPeriodEnded] = useState(false);

  async function call(path: string, body: Record<string, unknown> = {}) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${match.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtToken, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo completar la acción.");
        return null;
      }
      router.refresh();
      return json;
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("¿Abriste este partido por error? Se pierde el progreso del reloj y de los rounds.")) return;
    await fetch(`/api/matches/${match.id}/start`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtToken }),
    });
    router.refresh();
  }

  async function handleAdvancePeriod() {
    const json = await call("advance-period");
    if (json?.isLastPeriod) setPeriodEnded(true);
  }

  async function handleLiveScoreBlur() {
    const a = Math.max(0, Number(liveScoreA) || 0);
    const b = Math.max(0, Number(liveScoreB) || 0);
    await call("live-score", { scoreA: a, scoreB: b });
  }

  // `periodEnded` es estado local: si el juez refresca la página justo
  // después de terminar el último tiempo (antes de cerrar el partido), vuelve
  // a ver el marcador en vivo — tocar "Terminar el partido" de nuevo es
  // idempotente del lado del servidor (isLastPeriod vuelve a dar true) y
  // reactiva este mismo cartel.
  const showFinalize = periodEnded;

  // Un partido 'in_progress' siempre debería tener los dos equipos definidos
  // (start/route.ts no lo permite si no) — esto es solo para que TypeScript
  // no se queje del `string | null` de Match y como red de seguridad.
  if (!match.team_a_id || !match.team_b_id) {
    return <p className="text-sm panel-label">Todavía no están definidos los dos equipos.</p>;
  }
  const teamAId = match.team_a_id;
  const teamBId = match.team_b_id;

  if (competition.period_seconds == null) {
    // Torneo sin timer configurado (dato viejo, anterior a esta función) —
    // no rompemos: se cae al cierre manual de siempre.
    return (
      <ResultForm
        courtToken={courtToken}
        matchId={match.id}
        teamAId={teamAId}
        teamBId={teamBId}
        teamAName={teamAName}
        teamBName={teamBName}
        allowDraws={competition.allow_draws}
      />
    );
  }

  if (showFinalize) {
    return (
      <section className="panel-card rounded-xl p-4 space-y-4 panel-enter">
        <p className="text-sm panel-label">Terminó el último tiempo — cargá el resultado final:</p>
        <ResultForm
          courtToken={courtToken}
          matchId={match.id}
          teamAId={teamAId}
          teamBId={teamBId}
          teamAName={teamAName}
          teamBName={teamBName}
          allowDraws={competition.allow_draws}
          initialScoreA={liveScoreA}
          initialScoreB={liveScoreB}
        />
      </section>
    );
  }

  return (
    <section className="panel-card rounded-xl p-5 space-y-5 panel-enter">
      <p className="text-lg font-display font-semibold text-center">
        {teamAName} <span className="panel-label font-normal">vs</span> {teamBName}
      </p>

      <MatchClock match={match} competition={competition} size="hero" />

      {error && <p className="text-sm text-red-500 dark:text-red-400 text-center panel-enter">{error}</p>}

      <div className="flex gap-2">
        {isPaused(match) ? (
          <button
            onClick={() => call("resume")}
            disabled={pending}
            className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-3 text-base disabled:opacity-50"
          >
            ▶ Reanudar
          </button>
        ) : (
          <button
            onClick={() => call("pause")}
            disabled={pending || !isRunning(match)}
            className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-3 text-base disabled:opacity-50"
          >
            ⏸ Pausar
          </button>
        )}
      </div>

      {competition.timer_mode === "rounds" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => call("round-result", { roundWinnerId: match.team_a_id })}
            disabled={pending}
            className="rounded-lg py-4 text-sm font-display font-semibold border border-brand-teal/50 bg-brand-teal/10 hover:bg-brand-teal/20 transition active:scale-[0.97] disabled:opacity-50"
          >
            Ganó {teamAName}
          </button>
          <button
            onClick={() => call("round-result", { roundWinnerId: match.team_b_id })}
            disabled={pending}
            className="rounded-lg py-4 text-sm font-display font-semibold border border-brand-pink/50 bg-brand-pink/10 hover:bg-brand-pink/20 transition active:scale-[0.97] disabled:opacity-50"
          >
            Ganó {teamBName}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={liveScoreA}
              onChange={(e) => setLiveScoreA(e.target.value)}
              onBlur={handleLiveScoreBlur}
              className="w-20 text-center text-2xl rounded-lg panel-input py-2"
            />
            <span className="panel-label">—</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={liveScoreB}
              onChange={(e) => setLiveScoreB(e.target.value)}
              onBlur={handleLiveScoreBlur}
              className="w-20 text-center text-2xl rounded-lg panel-input py-2"
            />
          </div>
          <button
            onClick={handleAdvancePeriod}
            disabled={pending}
            className="w-full rounded-lg panel-button-accent font-display font-semibold py-3 disabled:opacity-50"
          >
            Terminar {competition.periods_count > 1 ? "este tiempo" : "el partido"}
          </button>
        </div>
      )}

      <button onClick={handleCancel} className="text-xs panel-label hover:opacity-80 transition-opacity underline block mx-auto">
        Abrí mal, volver
      </button>
    </section>
  );
}
