"use client";

import { useRef, useState, useTransition } from "react";
import { setTeamAccredited, setTeamHomologated, setTeamParticipantsPresent, setTeamMemberNames } from "./actions";
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
  const [accredited, setAccreditedState] = useState(team.accredited);
  const accreditedRef = useRef<HTMLInputElement>(null);
  const homologatedRef = useRef<HTMLInputElement>(null);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleAccreditedChange(checked: boolean) {
    setError(null);
    setAccreditedState(checked);
    // homologado ⟹ acreditado: al desacreditar, el server también baja la
    // homologación (ver setTeamAccredited) — reflejar acá.
    if (!checked && homologatedRef.current) homologatedRef.current.checked = false;
    startTransition(async () => {
      try {
        await setTeamAccredited(competitionId, team.id, checked);
        flashSaved();
      } catch (err) {
        if (accreditedRef.current) accreditedRef.current.checked = !checked;
        setAccreditedState(!checked);
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

  // Mismo relleno "chip" que panel-chip-success en reposo cuando está
  // tildado — via has-[:checked], no estado de React aparte: el checkbox
  // (defaultChecked, sin controlar) ya es la única fuente de verdad, así
  // que el chip nunca puede desincronizarse de lo que el usuario ve tildado.
  const toggleChipClass =
    "flex items-center gap-1.5 text-xs font-medium rounded-full border pl-1.5 pr-2.5 py-1 cursor-pointer select-none transition-colors " +
    "border-neutral-300 dark:border-neutral-700 panel-label hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
    "has-[:checked]:border-brand-green/30 has-[:checked]:text-brand-green has-[:checked]:bg-brand-green/12 dark:has-[:checked]:border-brand-green/35 " +
    "has-[:disabled]:opacity-50";

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

  function handleMemberNamesBlur(value: string) {
    setError(null);
    const formData = new FormData();
    formData.set("member_names", value);
    startTransition(async () => {
      try {
        await setTeamMemberNames(competitionId, team.id, formData);
        flashSaved();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className={toggleChipClass}>
          <input
            ref={accreditedRef}
            type="checkbox"
            defaultChecked={team.accredited}
            disabled={pending}
            onChange={(e) => handleAccreditedChange(e.target.checked)}
            className="peer sr-only"
          />
          <span aria-hidden="true" className="hidden peer-checked:inline">
            ✓
          </span>
          <span aria-hidden="true" className="peer-checked:hidden">
            ○
          </span>{" "}
          Acreditado
        </label>
        <label
          className={toggleChipClass}
          title={!accredited ? "Primero acreditá al equipo" : undefined}
        >
          <input
            ref={homologatedRef}
            type="checkbox"
            defaultChecked={team.homologated}
            disabled={pending || !accredited}
            onChange={(e) => handleHomologatedChange(e.target.checked)}
            className="peer sr-only"
          />
          <span aria-hidden="true" className="hidden peer-checked:inline">
            ✓
          </span>
          <span aria-hidden="true" className="peer-checked:hidden">
            ○
          </span>{" "}
          Homologado
        </label>
        <label
          className="flex items-center gap-1.5 text-xs rounded-full border border-neutral-300 dark:border-neutral-700 panel-label pl-2.5 pr-1 py-1"
          title="Cantidad de personas presentes de este equipo"
        >
          Presentes
          <input
            type="number"
            min={0}
            defaultValue={team.participants_present ?? team.member_count ?? ""}
            disabled={pending}
            className="w-10 rounded panel-input px-1 py-0.5 text-xs disabled:opacity-50"
            onBlur={(e) => handlePresentBlur(e.currentTarget.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </label>
        {pending && <span className="text-xs panel-label">…</span>}
        {saved && <span className="text-xs text-brand-green panel-enter">✓ Guardado</span>}
        {error && <span className="text-xs text-red-500 dark:text-red-400 panel-enter">{error}</span>}
      </div>
      <input
        type="text"
        defaultValue={team.member_names ?? ""}
        disabled={pending}
        placeholder="Integrantes, separados por coma"
        title="Nombres de las personas de este equipo — se muestran públicamente entre paréntesis debajo del nombre del robot"
        className="w-full rounded panel-input px-2 py-1 text-xs disabled:opacity-50 bg-transparent border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:bg-white dark:focus:bg-neutral-900"
        onBlur={(e) => handleMemberNamesBlur(e.currentTarget.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
