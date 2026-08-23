"use client";

import { useState, useTransition } from "react";
import { setTeamSeed } from "./actions";

/** Semilla manual de un equipo, solo para `format_type = 'bracket_only'`
 * (cuadro sin fase de grupos) — define el orden de siembra al generar el
 * cuadro (1º vs último, 2º vs anteúltimo...). Se guarda solo al perder el
 * foco, mismo patrón que ManualRankInput. Vacío = sin forzar, se ordena por
 * fecha de carga. */
export function TeamSeedInput({
  competitionId,
  teamId,
  defaultValue,
}: {
  competitionId: string;
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
    formData.set("seed", value);
    startTransition(async () => {
      try {
        await setTeamSeed(competitionId, teamId, formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[11px] uppercase tracking-wide panel-label shrink-0">Semilla</span>
      <input
        name="seed"
        type="number"
        min={1}
        defaultValue={defaultValue ?? ""}
        disabled={pending}
        placeholder="-"
        title="Orden de siembra para el cuadro — vacío = se usa el orden en que se cargó el equipo"
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
        {pending ? "…" : saved ? <span className="text-brand-green panel-enter">✓</span> : null}
      </span>
      {error && <span className="text-xs text-red-500 dark:text-red-400 panel-enter">{error}</span>}
    </span>
  );
}
