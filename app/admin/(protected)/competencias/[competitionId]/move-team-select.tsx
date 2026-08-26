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
  teamName,
  options,
}: {
  competitionId: string;
  teamId: string;
  teamName: string;
  options: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(0); // fuerza que el <select> vuelva al placeholder (tras mover o cancelar)

  if (options.length === 0) return null;

  // El equipo desaparece de esta lista apenas se mueve (queda en el torneo
  // destino) — un cartel post-movimiento en esta misma fila corre el riesgo
  // de no alcanzar a verse si la lista se actualiza antes. Por eso el
  // resultado (éxito o error) se avisa con un alert() nativo, que no
  // depende de que esta fila siga montada — pedido explícito del usuario
  // ("un cartel... y además después uno de éxito o no").
  return (
    <select
      key={key}
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const opt = options.find((o) => o.id === e.target.value);
        if (!opt) return;
        const cleanLabel = opt.label;
        const confirmMsg =
          `¿Mover "${teamName}" a "${cleanLabel}"?` +
          (opt.crossDiscipline
            ? '\n\nCambia de disciplina: revisá los robots del equipo en "Editar equipo" después de moverlo.'
            : "");
        if (!window.confirm(confirmMsg)) {
          setKey((k) => k + 1); // el <select> ya mostraba la opción elegida — lo vuelve al placeholder
          return;
        }
        startTransition(async () => {
          try {
            await moveTeamToCompetition(competitionId, teamId, opt.id);
            window.alert(`✅ "${teamName}" se movió a "${cleanLabel}".`);
          } catch (err) {
            window.alert(`❌ No se pudo mover "${teamName}": ${(err as Error).message ?? "error desconocido"}`);
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
  );
}
