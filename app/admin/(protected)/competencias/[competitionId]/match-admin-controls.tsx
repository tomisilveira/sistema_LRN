"use client";

import { useState, useTransition } from "react";
import type { MatchActionResult } from "./actions";
import { MatchResultForm } from "./match-result-form";

/** Botones del admin sobre un partido ya jugado (o en curso): corregir el
 * resultado y reiniciar el partido. Cartel de confirmación propio, nunca
 * `window.confirm` (se bloquea en celular/tablet). */
export function MatchAdminControls({
  played,
  correctAction,
  resetAction,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  allowDraws,
  knockout = false,
  scoreA,
  scoreB,
  layout = "inline",
}: {
  /** false = en curso: solo se ofrece reiniciar (cargar va por el form de siempre). */
  played: boolean;
  correctAction: (formData: FormData) => Promise<MatchActionResult>;
  resetAction: () => Promise<MatchActionResult>;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  allowDraws: boolean;
  /** Partido de la fase final (ver MatchResultForm). */
  knockout?: boolean;
  scoreA: number | null;
  scoreB: number | null;
  layout?: "inline" | "stacked";
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "reset">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmReset() {
    setError(null);
    startTransition(async () => {
      const res = await resetAction();
      if (!res.ok) setError(res.error ?? "No se pudo reiniciar el partido.");
      setMode("idle");
    });
  }

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-1">
        <MatchResultForm
          action={correctAction}
          teamAId={teamAId}
          teamBId={teamBId}
          teamAName={teamAName}
          teamBName={teamBName}
          allowDraws={allowDraws}
          knockout={knockout}
          defaultScoreA={scoreA}
          defaultScoreB={scoreB}
          submitLabel="Guardar corrección"
          onDone={() => setMode("idle")}
          layout={layout}
        />
        <button type="button" onClick={() => setMode("idle")} className="self-start text-[11px] panel-label underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <span className="inline-flex flex-col gap-1.5 rounded-md border border-red-500/30 bg-red-500/8 p-2 text-xs max-w-[260px] panel-enter">
        <span className="panel-label">
          {played
            ? "Se borra el resultado, los rounds y las tarjetas de este partido y vuelve a quedar para jugar. ¿Reiniciar?"
            : "Se corta el partido en curso (reloj, rounds y tarjetas en cero) y vuelve a quedar para jugar. ¿Reiniciar?"}
        </span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={confirmReset}
            disabled={pending}
            className="flex-1 rounded panel-button-danger py-1.5 font-medium disabled:opacity-50"
          >
            {pending ? "…" : "Sí, reiniciar"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={pending}
            className="flex-1 rounded panel-button-secondary py-1.5"
          >
            Cancelar
          </button>
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {played && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("edit");
            }}
            className="text-xs rounded panel-button-secondary px-2 py-1 whitespace-nowrap"
          >
            ✏️ Corregir resultado
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("reset");
          }}
          className="text-xs rounded panel-button-secondary px-2 py-1 whitespace-nowrap"
        >
          ↺ Reiniciar partido
        </button>
      </div>
      {error && <span className="text-xs text-red-500 panel-enter">{error}</span>}
    </div>
  );
}
