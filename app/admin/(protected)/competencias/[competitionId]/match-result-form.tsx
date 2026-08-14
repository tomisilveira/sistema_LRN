"use client";

import { useState, useTransition } from "react";

/** Carga de resultado con validación en el cliente — antes esto dependía
 * 100% del server action (computeMatchOutcome), que tira un Error si falta
 * el marcador o el ganador directo; sin validar antes, un click en blanco
 * tiraba abajo toda la página con la pantalla roja de Next. Ahora se
 * valida acá y se muestra un mensaje corto al lado del botón, sin llegar
 * a pisar el server. */
export function MatchResultForm({
  action,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  allowDraws,
}: {
  action: (formData: FormData) => Promise<void>;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  allowDraws: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const winnerId = String(formData.get("winner_id") ?? "").trim();
    const scoreARaw = String(formData.get("score_a") ?? "").trim();
    const scoreBRaw = String(formData.get("score_b") ?? "").trim();

    if (!winnerId) {
      if (scoreARaw === "" || scoreBRaw === "") {
        setError("Cargá el marcador de ambos equipos o elegí un ganador directo.");
        return;
      }
      const scoreA = Number(scoreARaw);
      const scoreB = Number(scoreBRaw);
      if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
        setError("El marcador tiene que ser un número mayor o igual a 0.");
        return;
      }
      if (scoreA === scoreB && !allowDraws) {
        setError("Esta disciplina no admite empates: elegí un ganador.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await action(formData);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar el resultado.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1">
      <input
        name="score_a"
        type="number"
        min={0}
        placeholder="A"
        disabled={pending}
        className="w-12 rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
      />
      <input
        name="score_b"
        type="number"
        min={0}
        placeholder="B"
        disabled={pending}
        className="w-12 rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
      />
      <select
        name="winner_id"
        defaultValue=""
        disabled={pending}
        className="rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
      >
        <option value="">(o ganador directo)</option>
        <option value={teamAId ?? ""}>{teamAName}</option>
        <option value={teamBId ?? ""}>{teamBName}</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="text-xs rounded panel-button-primary px-2 py-1 disabled:opacity-50"
      >
        Cargar resultado
      </button>
      {error && <span className="text-xs text-red-500 dark:text-red-400 basis-full">{error}</span>}
    </form>
  );
}
