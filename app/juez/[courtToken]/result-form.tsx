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
}: {
  courtToken: string;
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  allowDraws: boolean;
}) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [mode, setMode] = useState<"score" | "winner">("score");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary =
    mode === "winner"
      ? `Ganó ${winnerId === teamAId ? teamAName : teamBName}`
      : `${teamAName} ${scoreA || 0} — ${scoreB || 0} ${teamBName}${
          scoreA === scoreB && scoreA !== "" ? " (empate)" : ""
        }`;

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
          winnerId: mode === "winner" ? winnerId : null,
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
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      setSubmitting(false);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded-lg bg-neutral-900 p-3">
        <p className="text-sm text-neutral-400">Confirmar resultado:</p>
        <p className="text-lg font-semibold">{summary}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={submitting}
            className="flex-1 rounded-md border border-neutral-700 py-2.5 text-sm"
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-md bg-brand-teal text-white font-medium py-2.5 text-sm transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
          >
            {submitting ? "Enviando..." : "Confirmar"}
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = mode === "score" ? scoreA !== "" && scoreB !== "" : winnerId !== "";

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode("score")}
          className={`flex-1 rounded-md py-1.5 border transition ${
            mode === "score" ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-700"
          }`}
        >
          Marcador
        </button>
        <button
          onClick={() => setMode("winner")}
          className={`flex-1 rounded-md py-1.5 border transition ${
            mode === "winner" ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-700"
          }`}
        >
          Ganó / perdió
        </button>
      </div>

      {mode === "score" ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="text-sm text-neutral-400 mb-1">{teamAName}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="w-full text-center text-2xl rounded-lg bg-neutral-900 border border-neutral-700 py-3 outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
            />
          </div>
          <span className="text-neutral-600">—</span>
          <div className="flex-1 text-center">
            <p className="text-sm text-neutral-400 mb-1">{teamBName}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="w-full text-center text-2xl rounded-lg bg-neutral-900 border border-neutral-700 py-3 outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setWinnerId(teamAId)}
            className={`rounded-lg py-4 text-sm font-medium border transition ${
              winnerId === teamAId ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-700"
            }`}
          >
            Ganó {teamAName}
          </button>
          <button
            onClick={() => setWinnerId(teamBId)}
            className={`rounded-lg py-4 text-sm font-medium border transition ${
              winnerId === teamBId ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-700"
            }`}
          >
            Ganó {teamBName}
          </button>
        </div>
      )}

      {mode === "score" && !allowDraws && scoreA !== "" && scoreB !== "" && scoreA === scoreB && (
        <p className="text-xs text-amber-400">Esta disciplina no admite empates: corregí el marcador.</p>
      )}

      <button
        onClick={() => setConfirming(true)}
        disabled={
          !canSubmit || (mode === "score" && !allowDraws && scoreA !== "" && scoreB !== "" && scoreA === scoreB)
        }
        className="w-full rounded-md bg-brand-teal text-white font-medium py-3 transition hover:brightness-90 disabled:opacity-40 disabled:hover:brightness-100"
      >
        Cargar resultado
      </button>
    </div>
  );
}
