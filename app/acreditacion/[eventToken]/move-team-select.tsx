"use client";

import { useState, useTransition } from "react";
import { moveTeamToCompetition } from "./actions";

type Option = { id: string; label: string; crossDiscipline: boolean };
type Step = "idle" | "confirm" | "success" | "error";

/** Mismo componente/patrón que move-team-select.tsx del panel admin
 * (competencias/[competitionId]), adaptado a la mesa de acreditación (sin
 * login, todo por eventToken). El confirmar/cancelar y el resultado son
 * propios del sistema (no `window.confirm`/`window.alert`) — en el
 * celular/tablet de la mesa de acreditación esos diálogos nativos se
 * pueden bloquear o no aparecer si se disparan justo al cerrar el picker
 * nativo del `<select>`, reportado en vivo 2026-08-27. */
export function MoveTeamSelect({
  eventToken,
  teamId,
  teamName,
  options,
}: {
  eventToken: string;
  teamId: string;
  teamName: string;
  options: Option[];
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("idle");
  const [chosen, setChosen] = useState<Option | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  if (options.length === 0) return null;

  function reset() {
    setStep("idle");
    setChosen(null);
    setResultMessage(null);
    setKey((k) => k + 1);
  }

  function handleConfirm() {
    if (!chosen) return;
    const opt = chosen;
    startTransition(async () => {
      try {
        await moveTeamToCompetition(eventToken, teamId, opt.id);
        setResultMessage(`✅ "${teamName}" se movió a "${opt.label}".`);
        setStep("success");
        await new Promise((r) => setTimeout(r, 1800));
      } catch (err) {
        setResultMessage((err as Error).message ?? "No se pudo mover el equipo.");
        setStep("error");
      }
    });
  }

  if (step === "confirm" && chosen) {
    return (
      <div className="flex flex-col gap-1.5 text-xs rounded-md border border-brand-teal/40 bg-brand-teal/8 dark:bg-brand-teal/10 p-2 max-w-[220px] panel-enter">
        <p className="panel-label">
          ¿Mover a <span className="font-medium text-neutral-800 dark:text-neutral-100">{chosen.label}</span>?
          {chosen.crossDiscipline && ' Cambia de disciplina — revisá los robots después con "Editar".'}
        </p>
        <div className="flex gap-1.5">
          <button type="button" disabled={pending} onClick={handleConfirm} className="flex-1 rounded panel-button-xs py-1">
            {pending ? "Moviendo…" : "Sí, mover"}
          </button>
          <button type="button" disabled={pending} onClick={reset} className="flex-1 rounded panel-button-secondary py-1">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (step === "success" || step === "error") {
    return (
      <p
        className={`text-xs rounded-md px-2 py-1 max-w-[200px] panel-enter ${
          step === "success"
            ? "panel-chip-success"
            : "text-red-600 dark:text-red-400 border border-red-500/30 bg-red-500/8 cursor-pointer"
        }`}
        onClick={step === "error" ? reset : undefined}
        title={step === "error" ? "Tocar para cerrar" : undefined}
      >
        {resultMessage}
      </p>
    );
  }

  return (
    <select
      key={key}
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const opt = options.find((o) => o.id === e.target.value);
        if (!opt) return;
        setChosen(opt);
        setStep("confirm");
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
