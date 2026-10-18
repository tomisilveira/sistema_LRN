"use client";

import { useState, useTransition } from "react";
import type { MatchActionResult } from "./actions";

/** Carga (o corrección) de resultado con validación en el cliente — antes
 * esto dependía 100% del server action (computeMatchOutcome), que tira un
 * Error si falta el marcador o el ganador directo; sin validar antes, un
 * click en blanco tiraba abajo toda la página con la pantalla roja de Next.
 * Ahora se valida acá, y antes de guardar se muestra el resultado a
 * confirmar ("gana X 2–1") — mismo paso que ya tenía el juez de cancha. */
export function MatchResultForm({
  action,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  allowDraws,
  defaultScoreA,
  defaultScoreB,
  submitLabel = "Cargar resultado",
  onDone,
  layout = "inline",
}: {
  action: (formData: FormData) => Promise<void | MatchActionResult>;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  allowDraws: boolean;
  /** Marcador ya cargado, para corregir sin retipear todo. */
  defaultScoreA?: number | null;
  defaultScoreB?: number | null;
  submitLabel?: string;
  onDone?: () => void;
  /** 'stacked' para la tarjeta angosta del cuadro. */
  layout?: "inline" | "stacked";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scoreA, setScoreA] = useState(defaultScoreA != null ? String(defaultScoreA) : "");
  const [scoreB, setScoreB] = useState(defaultScoreB != null ? String(defaultScoreB) : "");
  const [winnerId, setWinnerId] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  function nameOf(id: string) {
    return id === teamAId ? teamAName : teamBName;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (winnerId) {
      setConfirming(`Gana ${nameOf(winnerId)}`);
      return;
    }
    if (scoreA.trim() === "" || scoreB.trim() === "") {
      setError("Cargá el marcador de ambos equipos o elegí un ganador directo.");
      return;
    }
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      setError("El marcador tiene que ser un número mayor o igual a 0.");
      return;
    }
    if (a === b && !allowDraws) {
      setError("Esta disciplina no admite empates: elegí un ganador.");
      return;
    }
    setConfirming(
      a === b
        ? `${teamAName} ${a} – ${b} ${teamBName} · empate`
        : `${teamAName} ${a} – ${b} ${teamBName} · gana ${a > b ? teamAName : teamBName}`
    );
  }

  function handleConfirm() {
    const formData = new FormData();
    if (winnerId) {
      formData.set("winner_id", winnerId);
    } else {
      formData.set("score_a", scoreA.trim());
      formData.set("score_b", scoreB.trim());
    }
    startTransition(async () => {
      try {
        const res = await action(formData);
        if (res && !res.ok) {
          setError(res.error ?? "No se pudo guardar el resultado.");
          setConfirming(null);
          return;
        }
        setConfirming(null);
        onDone?.();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar el resultado.");
        setConfirming(null);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-brand-teal/40 bg-brand-teal/5 p-2 text-xs panel-enter">
        <span className="panel-label">¿Confirmás este resultado?</span>
        <span className="text-sm font-semibold">{confirming}</span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="flex-1 rounded panel-button-primary px-2 py-1.5 font-medium disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Sí, guardar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            disabled={pending}
            className="flex-1 rounded panel-button-secondary px-2 py-1.5 disabled:opacity-50"
          >
            Volver
          </button>
        </span>
      </div>
    );
  }

  const stacked = layout === "stacked";

  return (
    <form onSubmit={handleSubmit} className={stacked ? "flex flex-col gap-1.5 pt-1" : "flex flex-wrap items-center gap-1"}>
      <div className={stacked ? "flex gap-1" : "contents"}>
        <input
          name="score_a"
          type="number"
          min={0}
          placeholder="A"
          title={teamAName}
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          disabled={pending}
          className={`${stacked ? "w-full" : "w-12"} rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50`}
        />
        <input
          name="score_b"
          type="number"
          min={0}
          placeholder="B"
          title={teamBName}
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          disabled={pending}
          className={`${stacked ? "w-full" : "w-12"} rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50`}
        />
      </div>
      <select
        name="winner_id"
        value={winnerId}
        onChange={(e) => setWinnerId(e.target.value)}
        disabled={pending}
        className={`${stacked ? "w-full" : ""} rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50`}
      >
        <option value="">(o ganador directo)</option>
        <option value={teamAId ?? ""}>{teamAName}</option>
        <option value={teamBId ?? ""}>{teamBName}</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="text-xs rounded panel-button-primary px-2 py-1 font-medium disabled:opacity-50"
      >
        {submitLabel}
      </button>
      {error && <span className="text-xs text-red-500 basis-full panel-enter">{error}</span>}
    </form>
  );
}
