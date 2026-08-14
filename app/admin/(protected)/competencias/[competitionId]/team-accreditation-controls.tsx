"use client";

import { useRef, useState, useTransition } from "react";
import { setTeamAccredited, setTeamHomologated, setTeamParticipantsPresent } from "./actions";
import type { Team } from "@/lib/database.types";

/** Acreditar/homologar un equipo directo desde la pestaña Equipos del panel
 * admin — mismos dos checks que la mesa de acreditación pública
 * (team-checkin-row.tsx), para no tener que salir a ese link aparte cuando
 * ya se está viendo el torneo. Guarda solo al tocar cada control. */
export function TeamAccreditationControls({
  competitionId,
  team,
}: {
  competitionId: string;
  team: Team;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const accreditedRef = useRef<HTMLInputElement>(null);
  const homologatedRef = useRef<HTMLInputElement>(null);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleAccreditedChange(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setTeamAccredited(competitionId, team.id, checked);
        flashSaved();
      } catch (err) {
        if (accreditedRef.current) accreditedRef.current.checked = !checked;
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  function handleHomologatedChange(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setTeamHomologated(competitionId, team.id, checked);
        flashSaved();
      } catch (err) {
        if (homologatedRef.current) homologatedRef.current.checked = !checked;
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  function handlePresentBlur(value: string) {
    setError(null);
    const formData = new FormData();
    formData.set("participants_present", value);
    startTransition(async () => {
      try {
        await setTeamParticipantsPresent(competitionId, team.id, formData);
        flashSaved();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  const ready = team.accredited && team.homologated;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
      <label className="flex items-center gap-1 text-xs panel-label">
        <input
          ref={accreditedRef}
          type="checkbox"
          defaultChecked={team.accredited}
          disabled={pending}
          onChange={(e) => handleAccreditedChange(e.target.checked)}
          className="rounded accent-brand-teal w-3.5 h-3.5 disabled:opacity-50"
        />
        Acreditado
      </label>
      <label className="flex items-center gap-1 text-xs panel-label">
        <input
          ref={homologatedRef}
          type="checkbox"
          defaultChecked={team.homologated}
          disabled={pending}
          onChange={(e) => handleHomologatedChange(e.target.checked)}
          className="rounded accent-brand-teal w-3.5 h-3.5 disabled:opacity-50"
        />
        Homologado
      </label>
      <label className="flex items-center gap-1 text-xs panel-label" title="Cantidad de personas presentes de este equipo">
        Presentes
        <input
          type="number"
          min={0}
          defaultValue={team.participants_present ?? team.member_count ?? ""}
          disabled={pending}
          className="w-12 rounded panel-input px-1 py-0.5 text-xs disabled:opacity-50"
          onBlur={(e) => handlePresentBlur(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      <span
        className={`text-xs rounded-full px-2 py-0.5 font-medium ${ready ? "panel-chip-success" : "panel-chip-warning"}`}
      >
        {ready ? "✅ Listo" : "⏳ Falta"}
      </span>
      {pending && <span className="text-xs panel-label">…</span>}
      {saved && <span className="text-xs text-brand-green">✓</span>}
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </div>
  );
}
