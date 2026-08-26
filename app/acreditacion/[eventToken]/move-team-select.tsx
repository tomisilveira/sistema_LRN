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
  teamName,
  options,
}: {
  eventToken: string;
  teamId: string;
  teamName: string;
  options: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(0);

  if (options.length === 0) return null;

  return (
    <select
      key={key}
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const opt = options.find((o) => o.id === e.target.value);
        if (!opt) return;
        const confirmMsg =
          `¿Mover "${teamName}" a "${opt.label}"?` +
          (opt.crossDiscipline
            ? '\n\nCambia de disciplina: revisá los robots del equipo con "Editar" después de moverlo.'
            : "");
        if (!window.confirm(confirmMsg)) {
          setKey((k) => k + 1);
          return;
        }
        startTransition(async () => {
          try {
            await moveTeamToCompetition(eventToken, teamId, opt.id);
            window.alert(`✅ "${teamName}" se movió a "${opt.label}".`);
          } catch (err) {
            window.alert(`❌ No se pudo mover "${teamName}": ${(err as Error).message ?? "error desconocido"}`);
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
  );
}
