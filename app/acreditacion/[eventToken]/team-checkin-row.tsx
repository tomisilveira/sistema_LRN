"use client";

import { useRef, useState, useTransition } from "react";
import { setAccredited, setHomologated, setParticipantsPresent, updateTeam } from "./actions";
import type { Team } from "@/lib/database.types";
import type { DisciplineColorSet } from "@/lib/discipline-colors";
import { TeamLabel } from "@/app/components/team-label";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { ModalFormButton } from "@/app/components/modal-form";
import { parseRobotNames } from "@/lib/team-display";
import { MoveTeamSelect } from "./move-team-select";

const svgBase = {
  fill: "none",
  stroke: "currentColor" as const,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgBase} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8 17c0-1.7 1.8-3 4-3s4 1.3 4 3" />
    </svg>
  );
}
function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgBase} aria-hidden="true">
      <path d="M14.5 3.5a4.5 4.5 0 0 0-5.9 5.9L3 15v6h6l5.6-5.6a4.5 4.5 0 0 0 5.9-5.9l-3.3 3.3-3-3 3.3-3.3Z" />
    </svg>
  );
}
function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgBase} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function TeamCheckinRow({
  eventToken,
  team,
  isFutbol,
  colors,
  moveTargets,
}: {
  eventToken: string;
  team: Team;
  isFutbol: boolean;
  colors: DisciplineColorSet;
  moveTargets: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const [accredited, setAccreditedState] = useState(team.accredited);
  const [homologated, setHomologatedState] = useState(team.homologated);
  const [present, setPresent] = useState(team.participants_present ?? team.member_count ?? 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fuente de verdad para el stepper: refleja el valor incluso entre dos
  // taps rápidos, antes de que React re-renderice con el nuevo `present`.
  const presentRef = useRef(present);

  const ready = accredited && homologated;
  const statusLabel = ready
    ? "Listo"
    : accredited
      ? "Sin homologar"
      : homologated
        ? "Sin acreditar"
        : "No listo";

  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1400);
  }

  function toggleAccredited() {
    const next = !accredited;
    setError(null);
    setAccreditedState(next);
    // homologado ⟹ acreditado: al desacreditar se cae la homologación
    // (mismo criterio que el server, ver setAccredited en ./actions.ts).
    const prevHomologated = homologated;
    if (!next && homologated) setHomologatedState(false);
    startTransition(async () => {
      try {
        await setAccredited(eventToken, team.id, next);
        flashSaved();
      } catch (err) {
        setAccreditedState(!next);
        setHomologatedState(prevHomologated);
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  function toggleHomologated() {
    if (!accredited) return; // bloqueado hasta acreditar
    const next = !homologated;
    setError(null);
    setHomologatedState(next);
    startTransition(async () => {
      try {
        await setHomologated(eventToken, team.id, next);
        flashSaved();
      } catch (err) {
        setHomologatedState(!next);
        setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  function bumpPresent(delta: number) {
    setError(null);
    const next = Math.max(0, presentRef.current + delta);
    presentRef.current = next;
    setPresent(next);
    if (presentTimer.current) clearTimeout(presentTimer.current);
    presentTimer.current = setTimeout(() => {
      const formData = new FormData();
      formData.set("participants_present", String(presentRef.current));
      startTransition(async () => {
        try {
          await setParticipantsPresent(eventToken, team.id, formData);
          flashSaved();
        } catch (err) {
          setError((err as Error).message ?? "No se pudo guardar. Probá de nuevo.");
        }
      });
    }, 650);
  }

  const toggleBase =
    "h-11 rounded-lg border-[1.5px] font-medium text-[13.5px] flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]";
  const toggleOn = "bg-brand-teal border-brand-teal text-white";
  const toggleOff =
    "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300";
  const toggleLocked =
    "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-400 opacity-60 cursor-not-allowed";

  return (
    <div
      className={`panel-card rounded-xl overflow-hidden border-l-4 transition-colors ${
        ready ? "border-l-brand-green" : "border-l-neutral-300 dark:border-l-neutral-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2.5 px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border font-display font-bold text-sm ${colors.bg} ${colors.text} ${colors.border}`}
            aria-hidden="true"
          >
            {team.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[15px] leading-tight truncate">
              <TeamLabel name={team.name} memberNames={team.member_names} />
            </p>
            {team.institution && (
              <p className="text-[12.5px] panel-label truncate mt-0.5">{team.institution}</p>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${
            ready ? "panel-chip-success" : "panel-chip-warning"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="px-4 pb-3.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={toggleAccredited}
            disabled={pending}
            className={`${toggleBase} disabled:opacity-60 ${accredited ? toggleOn : toggleOff}`}
          >
            <BadgeIcon className="w-4 h-4" />
            Acreditado
          </button>
          <button
            type="button"
            onClick={toggleHomologated}
            disabled={pending || !accredited}
            title={!accredited ? "Primero acreditá al equipo" : "Homologación técnica"}
            className={`${toggleBase} ${
              !accredited ? toggleLocked : homologated ? toggleOn : toggleOff
            } disabled:opacity-60`}
          >
            {!accredited ? <LockIcon className="w-4 h-4" /> : <WrenchIcon className="w-4 h-4" />}
            Homologación
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap border-t border-neutral-200/70 dark:border-neutral-800 pt-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[12.5px] font-semibold panel-label">Presentes</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => bumpPresent(-1)}
                disabled={pending || present === 0}
                aria-label="Restar un participante"
                className="w-9 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-lg leading-none panel-label hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 active:scale-95"
              >
                −
              </button>
              <span className="w-7 text-center font-display font-bold text-base tabular-nums">{present}</span>
              <button
                type="button"
                onClick={() => bumpPresent(1)}
                disabled={pending}
                aria-label="Sumar un participante"
                className="w-9 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-lg leading-none panel-label hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 active:scale-95"
              >
                +
              </button>
            </div>
            {saved && (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-green panel-enter">
                <CheckIcon className="w-3 h-3" />
                Guardado
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <MoveTeamSelect eventToken={eventToken} teamId={team.id} teamName={team.name} options={moveTargets} />
            <ModalFormButton
              buttonLabel="Editar"
              buttonClassName="text-[11.5px] rounded-md px-2.5 h-[30px] panel-button-secondary"
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
                  memberNames: team.member_names,
                  notes: team.notes ?? "",
                }}
              />
            </ModalFormButton>
          </div>
        </div>

        {error && <p className="text-[12px] text-red-500 dark:text-red-400 panel-enter">{error}</p>}
      </div>
    </div>
  );
}
