"use client";

import { useRef, useState, useTransition } from "react";
import { setAccredited, setHomologated, setParticipantsPresent } from "./actions";
import type { Team } from "@/lib/database.types";

export function TeamCheckinRow({ eventToken, team }: { eventToken: string; team: Team }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const accreditedRef = useRef<HTMLInputElement>(null);
  const homologatedRef = useRef<HTMLInputElement>(null);
  const presentRef = useRef<HTMLInputElement>(null);

  const ready = team.accredited && team.homologated;

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleAccreditedChange(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setAccredited(eventToken, team.id, checked);
        flashSaved();
      } catch (err) {
        if (accreditedRef.current) accreditedRef.current.checked = !checked;
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  function handleHomologatedChange(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setHomologated(eventToken, team.id, checked);
        flashSaved();
      } catch (err) {
        if (homologatedRef.current) homologatedRef.current.checked = !checked;
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  function handleSavePresent() {
    setError(null);
    const formData = new FormData();
    formData.set("participants_present", presentRef.current?.value ?? "");
    startTransition(async () => {
      try {
        await setParticipantsPresent(eventToken, team.id, formData);
        flashSaved();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  return (
    <div
      className={`rounded-md px-3 py-2 flex flex-wrap items-center gap-4 text-sm border transition-colors ${
        ready ? "bg-brand-green/10 border-brand-green/40" : "panel-card"
      }`}
    >
      <div className="min-w-[160px] flex-1">
        <p className="font-medium">{team.name}</p>
        {team.institution && <p className="text-xs panel-label">{team.institution}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <label className="flex items-center gap-1.5 text-xs">
        <input
          ref={accreditedRef}
          type="checkbox"
          defaultChecked={team.accredited}
          disabled={pending}
          onChange={(e) => handleAccreditedChange(e.target.checked)}
          className="rounded accent-brand-teal w-4 h-4"
        />
        Acreditado
      </label>

      <label className="flex items-center gap-1.5 text-xs">
        <input
          ref={homologatedRef}
          type="checkbox"
          defaultChecked={team.homologated}
          disabled={pending}
          onChange={(e) => handleHomologatedChange(e.target.checked)}
          className="rounded accent-brand-teal w-4 h-4"
        />
        Homologación técnica
      </label>

      <div className="flex items-center gap-1.5">
        <label className="text-xs panel-label" htmlFor={`pp-${team.id}`}>
          Presentes
        </label>
        <input
          ref={presentRef}
          id={`pp-${team.id}`}
          name="participants_present"
          type="number"
          min={0}
          defaultValue={team.participants_present ?? team.member_count ?? ""}
          disabled={pending}
          className="w-16 rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
        <button
          type="button"
          onClick={handleSavePresent}
          disabled={pending}
          className="text-xs rounded-md panel-button-primary px-2.5 py-1 font-medium"
        >
          Guardar
        </button>
      </div>

      {saved && (
        <span className="text-xs text-brand-green font-medium panel-enter">✓ Guardado</span>
      )}
    </div>
  );
}
