"use client";

import { useState, useTransition } from "react";
import { setTeamAccredited, setTeamHomologated, setTeamParticipantsPresent } from "./actions";
import type { Team } from "@/lib/database.types";
import { CheckIcon, MinusIcon, PlusIcon } from "@/app/components/action-icons";

/** Acreditar/homologar un equipo directo desde la pestaña Equipos del panel
 * admin — mismos dos checks que la mesa de acreditación pública
 * (team-checkin-row.tsx), para no tener que salir a ese link aparte cuando
 * ya se está viendo el torneo. Guarda solo al tocar cada control.
 *
 * Rediseño sep 2026: casillas reales (antes eran chips con ✓/○ de texto que
 * no se leían como algo tocable) y "Presentes" con −/+ en vez de un input
 * numérico de 40px — pensado para la tablet de la mesa. Los integrantes ya
 * no se editan acá (había un input suelto sin etiqueta que repetía lo que
 * ya dice debajo del nombre): se editan desde "Editar". */
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
  const [accredited, setAccredited] = useState(team.accredited);
  const [homologated, setHomologated] = useState(team.homologated);
  const [present, setPresent] = useState<number>(team.participants_present ?? team.member_count ?? 0);

  function run(action: () => Promise<void>, rollback: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        rollback();
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  function toggleAccredited() {
    const next = !accredited;
    const prevHomologated = homologated;
    setAccredited(next);
    // homologado ⟹ acreditado: al desacreditar, el server también baja la
    // homologación (ver setTeamAccredited) — reflejar acá.
    if (!next) setHomologated(false);
    run(
      () => setTeamAccredited(competitionId, team.id, next),
      () => {
        setAccredited(!next);
        setHomologated(prevHomologated);
      }
    );
  }

  function toggleHomologated() {
    const next = !homologated;
    setHomologated(next);
    run(
      () => setTeamHomologated(competitionId, team.id, next),
      () => setHomologated(!next)
    );
  }

  function changePresent(delta: number) {
    const prev = present;
    const next = Math.max(0, prev + delta);
    if (next === prev) return;
    setPresent(next);
    const formData = new FormData();
    formData.set("participants_present", String(next));
    run(
      () => setTeamParticipantsPresent(competitionId, team.id, formData),
      () => setPresent(prev)
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <CheckToggle label="Acreditado" checked={accredited} disabled={pending} onToggle={toggleAccredited} />
        <CheckToggle
          label="Homologado"
          checked={homologated}
          disabled={pending || !accredited}
          hint={!accredited ? "Primero acreditá al equipo" : undefined}
          onToggle={toggleHomologated}
        />
        <div
          className="inline-flex items-center h-8 rounded-lg border border-neutral-200 bg-white text-xs"
          role="group"
          aria-label="Personas presentes"
        >
          <span className="pl-2.5 pr-1.5 panel-label font-medium">Presentes</span>
          <button
            type="button"
            onClick={() => changePresent(-1)}
            disabled={pending || present <= 0}
            aria-label="Uno menos"
            className="grid place-items-center w-7 h-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 border-l border-neutral-200"
          >
            <MinusIcon className="w-3.5 h-3.5" />
          </button>
          <span className="w-7 text-center font-semibold tabular-nums text-sm" aria-live="polite">
            {present}
          </span>
          <button
            type="button"
            onClick={() => changePresent(1)}
            disabled={pending}
            aria-label="Uno más"
            className="grid place-items-center w-7 h-full rounded-r-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 border-l border-neutral-200"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="text-[11px]" aria-live="polite">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : pending ? (
            <span className="panel-label">Guardando…</span>
          ) : saved ? (
            <span className="text-brand-green">Guardado</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function CheckToggle({
  label,
  checked,
  disabled,
  hint,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  hint?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      title={hint}
      className={`inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-teal ${
        checked
          ? "border-brand-green/40 bg-brand-green/10 text-green-800"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
      }`}
    >
      <span
        className={`grid place-items-center w-4 h-4 rounded border transition-colors ${
          checked ? "bg-brand-green border-brand-green text-white" : "border-neutral-300 bg-white"
        }`}
        aria-hidden="true"
      >
        {checked && <CheckIcon className="w-3 h-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
