"use client";

import { useState, useTransition } from "react";
import { mergeCompetitionTeams } from "./actions";

type Option = { id: string; label: string; crossDiscipline: boolean };
type Step = "idle" | "confirm" | "success" | "error";

/** Fusiona TODOS los equipos de este torneo con otro del evento, de un
 * solo click — para no repetir "Mover a otro torneo" (ver
 * move-team-select.tsx) equipo por equipo cuando son muchos. Mismo patrón
 * de cartel propio (no window.confirm/alert, ver [[confirm-dialogs-no-native-window]]):
 * elegir destino arma un cartel de confirmación con la cantidad real de
 * equipos, y el resultado se sostiene visible antes de que la página se
 * actualice (el torneo va a quedar sin equipos). */
export function MergeCompetitionButton({
  competitionId,
  teamCount,
  options,
}: {
  competitionId: string;
  teamCount: number;
  options: Option[];
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("idle");
  const [chosen, setChosen] = useState<Option | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  if (options.length === 0 || teamCount === 0) return null;

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
        const moved = await mergeCompetitionTeams(competitionId, opt.id);
        setResultMessage(`✅ Se movieron ${moved ?? teamCount} equipo(s) a "${opt.label}". Este torneo quedó vacío.`);
        setStep("success");
        await new Promise((r) => setTimeout(r, 2200));
      } catch (err) {
        setResultMessage((err as Error).message ?? "No se pudo fusionar el torneo.");
        setStep("error");
      }
    });
  }

  if (step === "confirm" && chosen) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/8 p-3 space-y-2 panel-enter">
        <p className="text-sm panel-label">
          ¿Mover los <span className="font-medium text-neutral-800 dark:text-neutral-100">{teamCount}</span> equipos
          de este torneo a <span className="font-medium text-neutral-800 dark:text-neutral-100">{chosen.label}</span>?
          Este torneo va a quedar vacío (no se borra solo).
          {chosen.crossDiscipline && ' Cambia de disciplina — revisá los robots de cada equipo después con "Editar".'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="flex-1 rounded-md panel-button-danger py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Fusionando…" : "Sí, fusionar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="flex-1 rounded-md panel-button-secondary py-2 text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (step === "success" || step === "error") {
    return (
      <p
        className={`text-sm rounded-md px-3 py-2 panel-enter ${
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
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm panel-label shrink-0" htmlFor="merge-target-select">
        Fusionar este torneo con:
      </label>
      <select
        id="merge-target-select"
        key={key}
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          const opt = options.find((o) => o.id === e.target.value);
          if (!opt) return;
          setChosen(opt);
          setStep("confirm");
        }}
        className="text-sm rounded-md panel-input px-2.5 py-1.5 disabled:opacity-50"
      >
        <option value="">Elegir torneo destino…</option>
        {options.map((o) => (
          <option
            key={o.id}
            value={o.id}
            title={o.crossDiscipline ? "Cambia de disciplina: revisá los robots de cada equipo después." : undefined}
          >
            {o.crossDiscipline ? `⚠️ ${o.label}` : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
