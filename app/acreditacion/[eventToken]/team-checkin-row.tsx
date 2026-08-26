"use client";

import { useRef, useState, useTransition } from "react";
import { setAccredited, setHomologated, setParticipantsPresent, updateTeam } from "./actions";
import type { Team } from "@/lib/database.types";
import { TeamLabel } from "@/app/components/team-label";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { ModalFormButton } from "@/app/components/modal-form";
import { parseRobotNames } from "@/lib/team-display";
import { MoveTeamSelect } from "./move-team-select";

export function TeamCheckinRow({
  eventToken,
  team,
  isFutbol,
  moveTargets,
}: {
  eventToken: string;
  team: Team;
  isFutbol: boolean;
  moveTargets: { id: string; label: string; crossDiscipline: boolean }[];
}) {
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
        <p className="font-medium">
          <TeamLabel name={team.name} memberNames={team.member_names} />
        </p>
        {team.institution && <p className="text-xs panel-label">{team.institution}</p>}
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        <ModalFormButton
          buttonLabel="Editar"
          buttonClassName="text-xs rounded-md px-2 py-0.5 mt-1 panel-button-secondary"
          title={`Editar ${team.name}`}
          description="Nombre mal escrito, robots, institución o integrantes — se corrige acá mismo, sin ir al panel admin."
          action={updateTeam.bind(null, eventToken, team.id)}
          submitLabel="Guardar"
        >
          <TeamFormFields
            isFutbol={isFutbol}
            defaults={{
              name: team.name,
              institution: team.institution ?? "",
              robots: parseRobotNames(team.robot_names),
              memberCount: team.member_count,
              memberNames: team.member_names,
              notes: team.notes ?? "",
            }}
          />
        </ModalFormButton>
      </div>
      <MoveTeamSelect eventToken={eventToken} teamId={team.id} teamName={team.name} options={moveTargets} />

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
          className="w-16 rounded panel-input px-1.5 py-1 text-xs"
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
