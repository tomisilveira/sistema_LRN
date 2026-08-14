"use client";

import { useState, useTransition } from "react";
import { setManualRankOverride } from "./actions";

/** Input de posición forzada que se guarda solo al perder el foco (o con
 * Enter) — mismo patrón que GroupAssignSelect/CourtDisciplineSelect, para no
 * repetir el botón "OK" de texto gris que antes quedaba casi invisible al
 * lado del input. Muestra un check breve al guardar y el error inline si
 * falla. */
export function ManualRankInput({
  competitionId,
  groupId,
  teamId,
  defaultValue,
}: {
  competitionId: string;
  groupId: string;
  teamId: string;
  defaultValue: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(value: string) {
    setSaved(false);
    setError(null);
    const formData = new FormData();
    formData.set("rank", value);
    startTransition(async () => {
      try {
        await setManualRankOverride(competitionId, groupId, teamId, formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        name="rank"
        type="number"
        min={1}
        defaultValue={defaultValue ?? ""}
        disabled={pending}
        placeholder="-"
        title="Forzar el puesto de este equipo en la tabla — vacío = orden automático por puntos"
        className="w-12 rounded panel-input px-1 py-0.5 text-xs text-center disabled:opacity-50"
        onBlur={(e) => save(e.currentTarget.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <span className="w-3.5 text-xs shrink-0" aria-live="polite">
        {pending ? "…" : saved ? <span className="text-brand-green">✓</span> : null}
      </span>
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </span>
  );
}
