"use client";

import { useState, useTransition } from "react";
import { moveTeamToCompetition } from "./actions";

/** Mismo componente/patrón que move-team-select.tsx del panel admin
 * (competencias/[competitionId]), adaptado a la mesa de acreditación (sin
 * login, todo por eventToken) — para corregir en el momento un equipo
 * anotado en la disciplina/categoría que no era, sin depender de que
 * alguien entre al panel admin. */
export function MoveTeamSelect({
  eventToken,
  teamId,
  options,
}: {
  eventToken: string;
  teamId: string;
  options: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-0.5">
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
              await moveTeamToCompetition(eventToken, teamId, value);
            } catch (err) {
              setError((err as Error).message ?? "No se pudo mover el equipo.");
            } finally {
              setKey((k) => k + 1);
            }
          });
        }}
        className="text-xs rounded-md panel-input px-2 py-1 disabled:opacity-50 max-w-[180px]"
      >
        <option value="">Mover a otro torneo…</option>
        {options.map((o) => (
          <option
            key={o.id}
            value={o.id}
            title={
              o.crossDiscipline
                ? 'Cambia de disciplina: revisá los robots del equipo con "Editar" después de moverlo.'
                : undefined
            }
          >
            {o.crossDiscipline ? `⚠️ ${o.label}` : o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-500 dark:text-red-400 max-w-[180px]">{error}</p>}
    </div>
  );
}
