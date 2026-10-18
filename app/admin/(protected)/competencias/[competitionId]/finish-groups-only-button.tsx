"use client";

import { useState, useTransition } from "react";
import type { MatchActionResult } from "./actions";

/** "Terminar sin fase final": el torneo queda solo con la fase de grupos y
 * los ganadores salen de la tabla de cada grupo (ver finishWithGroupsOnly).
 * Cartel de confirmación propio, nunca `window.confirm`. */
export function FinishGroupsOnlyButton({
  action,
  hasBracket,
  groupsPending,
}: {
  action: () => Promise<MatchActionResult>;
  /** Ya hay cuadro generado (sin jugar): se avisa que se borra. */
  hasBracket: boolean;
  /** Partidos de grupo que faltan jugar. */
  groupsPending: number;
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "No se pudo terminar el torneo.");
      setArmed(false);
    });
  }

  if (armed) {
    return (
      <span className="inline-flex flex-col gap-1.5 rounded-md border border-brand-orange/40 bg-brand-orange/8 p-2 text-xs max-w-[300px] panel-enter">
        <span className="panel-label">
          El torneo pasa a ser solo fase de grupos: 1º, 2º y 3º de cada grupo quedan como ganadores
          (pestaña 🏆 Ganadores).
          {hasBracket && " Se borra el cuadro de la fase final, que todavía no se jugó."}
          {groupsPending > 0 &&
            ` Faltan ${groupsPending} partido${groupsPending === 1 ? "" : "s"} de grupo: el torneo se termina solo al cargar el último.`}{" "}
          ¿Seguir?
        </span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="flex-1 rounded panel-button-primary py-1.5 font-medium disabled:opacity-50"
          >
            {pending ? "…" : "Sí, terminar con grupos"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
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
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs rounded-md panel-button-secondary px-3 py-1.5 whitespace-nowrap"
        title="Termina el torneo con la fase de grupos, sin jugar llaves."
      >
        🏁 Terminar sin fase final
      </button>
      {error && <span className="text-xs text-red-500 panel-enter max-w-[260px] text-right">{error}</span>}
    </span>
  );
}
