"use client";

import { useRef, useState, useTransition } from "react";
import { setAccredited, setHomologated, setParticipantsPresent } from "./actions";
import type { Team } from "@/lib/database.types";

export function TeamCheckinRow({ eventToken, team }: { eventToken: string; team: Team }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const accreditedRef = useRef<HTMLInputElement>(null);
  const homologatedRef = useRef<HTMLInputElement>(null);

  const ready = team.accredited && team.homologated;

  function handleAccreditedChange(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setAccredited(eventToken, team.id, checked);
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
      } catch (err) {
        if (homologatedRef.current) homologatedRef.current.checked = !checked;
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  return (
    <div
      className={`rounded-md px-3 py-2 flex flex-wrap items-center gap-4 text-sm border ${
        ready ? "bg-brand-green/10 border-brand-green/40" : "bg-neutral-900 border-transparent"
      }`}
    >
      <div className="min-w-[160px] flex-1">
        <p className="font-medium">{team.name}</p>
        {team.institution && <p className="text-xs text-neutral-500">{team.institution}</p>}
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

      <form action={setParticipantsPresent.bind(null, eventToken, team.id)} className="flex items-center gap-1.5">
        <label className="text-xs text-neutral-500" htmlFor={`pp-${team.id}`}>
          Presentes
        </label>
        <input
          id={`pp-${team.id}`}
          name="participants_present"
          type="number"
          min={0}
          defaultValue={team.participants_present ?? team.member_count ?? ""}
          className="w-16 rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
        <button type="submit" className="text-xs text-brand-teal hover:brightness-125 font-medium">
          OK
        </button>
      </form>
    </div>
  );
}
