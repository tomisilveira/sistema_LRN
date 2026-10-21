"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResultForm({
  courtToken,
  matchId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  allowDraws,
  knockout = false,
  initialScoreA = "",
  initialScoreB = "",
}: {
  courtToken: string;
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  allowDraws: boolean;
  /** Partido de la fase final: un empate en el marcador se define por
   * penales — el juez tiene que elegir quién ganó. */
  knockout?: boolean;
  /** Marcador ya cargado en vivo (modo 'periods') a precargar en el
   * formulario de cierre, para no tener que retipearlo. */
  initialScoreA?: string;
  initialScoreB?: string;
}) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState(initialScoreA);
  const [scoreB, setScoreB] = useState(initialScoreB);
  const [winnerId, setWinnerId] = useState("");
  const [penaltyWinnerId, setPenaltyWinnerId] = useState("");
  const [mode, setMode] = useState<"score" | "winner">("score");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = Number(scoreA || 0);
  const b = Number(scoreB || 0);
  const scoreTied = mode === "score" && scoreA !== "" && scoreB !== "" && a === b;
  // Fase final con empate: gana quien ganó por penales.
  const byPenalties = knockout && scoreTied;
  const nameOf = (id: string) => (id === teamAId ? teamAName : teamBName);
  const winnerName =
    mode === "winner"
      ? nameOf(winnerId)
      : byPenalties
        ? penaltyWinnerId
          ? nameOf(penaltyWinnerId)
          : null
        : a === b
          ? null
          : a > b
            ? teamAName
            : teamBName;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtToken,
          scoreA: mode === "score" && scoreA !== "" ? Number(scoreA) : null,
          scoreB: mode === "score" && scoreB !== "" ? Number(scoreB) : null,
          winnerId: mode === "winner" ? winnerId : byPenalties ? penaltyWinnerId : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al cargar el resultado.");
        setSubmitting(false);
        return;
      }
      setConfirming(false);
      setSubmitting(false);
      setScoreA("");
      setScoreB("");
      setWinnerId("");
      setPenaltyWinnerId("");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      setSubmitting(false);
    }
  }

  if (confirming) {
    return (
      // Mismo cartel que el cierre de sumo (MatchCloseConfirm en
      // match-timer-panel.tsx): marcador grande y quién gana, antes de cerrar.
      <div className="space-y-3 rounded-xl border-2 border-brand-orange/60 bg-brand-orange/8 p-4 panel-enter">
        <p className="text-xs uppercase tracking-wide font-display font-semibold text-brand-orange">
          Fin del partido — revisá antes de cerrar
        </p>
        <div className="rounded-lg bg-white/70 px-3 py-2 text-center">
          {mode === "score" && (
            <p className="text-base">
              {teamAName} <span className="font-display font-bold text-xl">{a}</span>
              <span className="panel-label"> – </span>
              <span className="font-display font-bold text-xl">{b}</span> {teamBName}
            </p>
          )}
          <p className="text-lg font-display font-semibold">
            {winnerName ? `Gana ${winnerName}${byPenalties ? " por penales" : ""}` : "Empate"}
          </p>
        </div>
        {error && <p className="text-sm text-red-500 panel-enter">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-3 text-sm disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Sí, cerrar partido"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-3 text-sm disabled:opacity-50"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const canSubmit =
    mode === "score" ? scoreA !== "" && scoreB !== "" && (!byPenalties || penaltyWinnerId !== "") : winnerId !== "";
  const blockedTie = scoreTied && !allowDraws && !knockout;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode("score")}
          className={`flex-1 rounded-md py-1.5 border transition active:scale-[0.97] ${
            mode === "score" ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-300 dark:border-neutral-700"
          }`}
        >
          Marcador
        </button>
        <button
          onClick={() => setMode("winner")}
          className={`flex-1 rounded-md py-1.5 border transition active:scale-[0.97] ${
            mode === "winner" ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-300 dark:border-neutral-700"
          }`}
        >
          Ganó / perdió
        </button>
      </div>

      {mode === "score" ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="text-sm panel-label mb-1">{teamAName}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="w-full text-center text-2xl rounded-lg panel-input py-3"
            />
          </div>
          <span className="panel-label">—</span>
          <div className="flex-1 text-center">
            <p className="text-sm panel-label mb-1">{teamBName}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="w-full text-center text-2xl rounded-lg panel-input py-3"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setWinnerId(teamAId)}
            className={`rounded-lg py-4 text-sm font-medium border transition active:scale-[0.97] ${
              winnerId === teamAId ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            Ganó {teamAName}
          </button>
          <button
            onClick={() => setWinnerId(teamBId)}
            className={`rounded-lg py-4 text-sm font-medium border transition active:scale-[0.97] ${
              winnerId === teamBId ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            Ganó {teamBName}
          </button>
        </div>
      )}

      {byPenalties && (
        <div className="rounded-lg border border-brand-orange/50 bg-brand-orange/8 p-3 space-y-2 panel-enter">
          <p className="text-sm font-medium">Empate en la fase final: ¿quién ganó por penales?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: teamAId, name: teamAName },
              { id: teamBId, name: teamBName },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setPenaltyWinnerId(t.id)}
                className={`rounded-lg py-3 text-sm font-medium border transition active:scale-[0.97] ${
                  penaltyWinnerId === t.id
                    ? "bg-brand-teal text-white border-brand-teal"
                    : "border-neutral-300 bg-white"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {blockedTie && (
        <p className="text-xs text-amber-400">Esta disciplina no admite empates: corregí el marcador.</p>
      )}

      <button
        onClick={() => setConfirming(true)}
        disabled={!canSubmit || blockedTie}
        className="w-full rounded-md panel-button-primary font-medium py-3 disabled:opacity-40"
      >
        Cargar resultado
      </button>
    </div>
  );
}
