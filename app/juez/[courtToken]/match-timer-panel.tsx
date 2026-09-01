"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Competition, Match, MatchCard, CardType } from "@/lib/database.types";
import { MatchClock } from "@/app/components/match-clock";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { isStopped } from "@/lib/match-timer";
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
  teamAMemberNames,
  teamBMemberNames,
  cards,
}: {
  courtToken: string;
  match: Match;
  competition: Competition;
  teamAName: string;
  teamBName: string;
  teamAMemberNames?: string | null;
  teamBMemberNames?: string | null;
  cards: MatchCard[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveScoreA, setLiveScoreA] = useState(String(match.score_a ?? 0));
  const [liveScoreB, setLiveScoreB] = useState(String(match.score_b ?? 0));
  const [periodEnded, setPeriodEnded] = useState(false);
  // Carteles de confirmación propios del sistema, no `window.confirm` — se
  // puede bloquear o no aparecer en el celular/tablet de la cancha
  // (reportado en vivo 2026-08-27 sobre "Mover a otro torneo", mismo
  // riesgo acá). null/false = sin armar; el valor identifica QUÉ se está
  // por confirmar (para la tarjeta roja, de qué equipo).
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingRoundTie, setConfirmingRoundTie] = useState(false);
  const [confirmingRedCard, setConfirmingRedCard] = useState<{ teamId: string; teamName: string } | null>(null);

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

  async function confirmedCancel() {
    setConfirmingCancel(false);
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

  async function handleCard(teamId: string, cardType: CardType, teamName: string) {
    if (cardType === "red") {
      setConfirmingRedCard({ teamId, teamName });
      return;
    }
    await call("card", { teamId, cardType });
  }

  async function confirmedRedCard() {
    if (!confirmingRedCard) return;
    const { teamId } = confirmingRedCard;
    setConfirmingRedCard(null);
    await call("card", { teamId, cardType: "red" });
  }

  async function confirmedRoundTie() {
    setConfirmingRoundTie(false);
    await call("round-tie");
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

  const teamCards = cardsByTeam(cards, teamAId, teamBId);

  return (
    <section className="panel-card rounded-xl p-5 space-y-5 panel-enter">
      <p className="text-xl font-display font-semibold text-center">
        <TeamLabel name={teamAName} memberNames={teamAMemberNames} />{" "}
        <TeamCardBadges summary={teamCards.a} className="align-middle" />{" "}
        <span className="panel-label font-normal">vs</span>{" "}
        <TeamLabel name={teamBName} memberNames={teamBMemberNames} />{" "}
        <TeamCardBadges summary={teamCards.b} className="align-middle" />
      </p>

      <MatchClock match={match} competition={competition} size="hero" />

      {error && <p className="text-sm text-red-500 dark:text-red-400 text-center panel-enter">{error}</p>}

      <div className="flex gap-2">
        {isStopped(match) ? (
          <button
            onClick={() => call("resume")}
            disabled={pending}
            className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-3 text-base disabled:opacity-50"
          >
            ▶{" "}
            {match.timer_elapsed_seconds > 0
              ? "Reanudar"
              : competition.timer_mode === "periods" && match.current_period > 1
                ? `Iniciar tiempo ${match.current_period}`
                : competition.timer_mode === "rounds" && match.current_period > 1
                  ? `Iniciar round ${match.current_period}`
                  : "Iniciar partido"}
          </button>
        ) : (
          <button
            onClick={() => call("pause")}
            disabled={pending}
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
          {confirmingRoundTie ? (
            <div className="col-span-2 rounded-lg border border-red-500/30 bg-red-500/8 p-2.5 space-y-2 panel-enter">
              <p className="text-sm panel-label">
                ¿Empataron este round? Se repite desde cero, no cuenta para ninguno de los dos.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmedRoundTie}
                  disabled={pending}
                  className="flex-1 rounded-lg panel-button-danger font-display font-semibold py-2 text-sm disabled:opacity-50"
                >
                  Sí, empataron
                </button>
                <button
                  onClick={() => setConfirmingRoundTie(false)}
                  disabled={pending}
                  className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-2 text-sm disabled:opacity-50"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingRoundTie(true)}
              disabled={pending}
              className="col-span-2 rounded-lg py-2.5 text-sm font-display font-semibold border border-neutral-300 dark:border-neutral-700 panel-label hover:bg-neutral-200 dark:hover:bg-neutral-800 transition active:scale-[0.97] disabled:opacity-50"
            >
              🤝 Empate — repetir este round
            </button>
          )}
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

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-2">
        <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
          Tarjetas — en caso de problemas
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => handleCard(teamAId, "yellow", teamAName)}
              disabled={pending}
              className="text-lg leading-none rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 hover:bg-yellow-400/20 active:scale-90 transition disabled:opacity-50"
              title={`Amarilla a ${teamAName}`}
              aria-label={`Amarilla a ${teamAName}`}
            >
              🟨
            </button>
            <button
              onClick={() => handleCard(teamAId, "red", teamAName)}
              disabled={pending}
              className="text-lg leading-none rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 hover:bg-red-500/20 active:scale-90 transition disabled:opacity-50"
              title={`Roja a ${teamAName}`}
              aria-label={`Roja a ${teamAName}`}
            >
              🟥
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => handleCard(teamBId, "yellow", teamBName)}
              disabled={pending}
              className="text-lg leading-none rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 hover:bg-yellow-400/20 active:scale-90 transition disabled:opacity-50"
              title={`Amarilla a ${teamBName}`}
              aria-label={`Amarilla a ${teamBName}`}
            >
              🟨
            </button>
            <button
              onClick={() => handleCard(teamBId, "red", teamBName)}
              disabled={pending}
              className="text-lg leading-none rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 hover:bg-red-500/20 active:scale-90 transition disabled:opacity-50"
              title={`Roja a ${teamBName}`}
              aria-label={`Roja a ${teamBName}`}
            >
              🟥
            </button>
          </div>
        </div>
        {confirmingRedCard && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/8 p-2.5 space-y-2 panel-enter">
            <p className="text-sm panel-label">
              ¿Tarjeta roja a {confirmingRedCard.teamName}? Queda registrada en el partido.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmedRedCard}
                disabled={pending}
                className="flex-1 rounded-lg panel-button-danger font-display font-semibold py-2 text-sm disabled:opacity-50"
              >
                Sí, tarjeta roja
              </button>
              <button
                onClick={() => setConfirmingRedCard(null)}
                disabled={pending}
                className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-2 text-sm disabled:opacity-50"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmingCancel ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/8 p-2.5 space-y-2 max-w-xs mx-auto panel-enter">
          <p className="text-sm panel-label text-center">
            ¿Abriste este partido por error? Se pierde el progreso del reloj y de los rounds.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmedCancel}
              className="flex-1 rounded-lg panel-button-danger font-display font-semibold py-2 text-sm"
            >
              Sí, volver
            </button>
            <button
              onClick={() => setConfirmingCancel(false)}
              className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-2 text-sm"
            >
              Seguir acá
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingCancel(true)}
          className="text-xs panel-label hover:opacity-80 transition-opacity underline block mx-auto"
        >
          Abrí mal, volver
        </button>
      )}
    </section>
  );
}
