"use client";

import { useState, useTransition } from "react";
import { moveTeamToCompetition } from "./actions";

/** Selector para mover un equipo a otro torneo del mismo evento (unificar o
 * dividir categorías sin recargar el equipo — ver [[e2e-simulation-scripts]]
 * / la conversación con el usuario). Solo lista torneos en "setup" (los que
 * ya arrancaron no pueden recibir equipos nuevos, ver moveTeamToCompetition).
 * A diferencia de GroupAssignSelect, no queda seleccionado el destino
 * después de mover — el equipo ya no está en este torneo, así que el
 * `<select>` vuelve al placeholder. */
export function MoveTeamSelect({
  competitionId,
  teamId,
  options,
}: {
  competitionId: string;
  teamId: string;
  options: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // fuerza que el <select> vuelva al placeholder tras mover

  if (options.length === 0) return null;

  // El equipo desaparece de esta lista apenas se mueve (queda en el torneo
  // destino), así que un aviso post-movimiento en esta misma fila nunca
  // llegaría a mostrarse — por eso el aviso de "cambia de disciplina" va
  // ANTES, como parte de la opción (⚠️ + tooltip nativo del <option>), no
  // después de moverlo.
  return (
    <div className="flex flex-col items-end gap-0.5">
      <select
        key={key}
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          setError(null);
          startTransition(async () => {
            try {
              await moveTeamToCompetition(competitionId, teamId, value);
            } catch (err) {
              setError((err as Error).message ?? "No se pudo mover el equipo.");
            } finally {
              setKey((k) => k + 1);
            }
          });
        }}
        className="text-xs rounded-md panel-input px-2 py-1 disabled:opacity-50 max-w-[160px]"
      >
        <option value="">Mover a otro torneo…</option>
        {options.map((o) => (
          <option
            key={o.id}
            value={o.id}
            title={
              o.crossDiscipline
                ? 'Cambia de disciplina: revisá los robots del equipo en "Editar equipo" después de moverlo.'
                : undefined
            }
          >
            {o.crossDiscipline ? `⚠️ ${o.label}` : o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-500 dark:text-red-400 text-right max-w-[160px]">{error}</p>}
    </div>
  );
}
