"use client";

import { useState, useTransition } from "react";
import { CheckIcon, ShuffleIcon } from "@/app/components/action-icons";
import { rebalanceCourts, type RebalanceResult } from "./actions";

/** Botón "Redistribuir canchas" (pestaña Partidos del torneo y Canchas del
 * evento). Primero explica qué va a pasar en un cartel propio — mueve
 * partidos de TODOS los torneos del evento y cambia lo que ven los jueces —
 * y después muestra el resultado: cuántos partidos se movieron y cómo
 * quedó repartida cada disciplina. */
export function RebalanceCourtsButton({ eventId, compact = false }: { eventId: string; compact?: boolean }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [result, setResult] = useState<RebalanceResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await rebalanceCourts(eventId).catch(
        (): RebalanceResult => ({ ok: false, error: "No se pudo conectar. Probá de nuevo." })
      );
      setResult(r);
      setStep("done");
    });
  }

  const sizeClass = compact ? "panel-action panel-action-sm" : "panel-action";

  if (step === "idle") {
    return (
      <button type="button" className={sizeClass} onClick={() => setStep("confirm")}>
        <ShuffleIcon />
        Redistribuir canchas
      </button>
    );
  }

  return (
    <div
      role={step === "done" ? "status" : undefined}
      className="w-full sm:w-[22rem] rounded-xl border border-brand-teal/30 bg-white p-3 text-sm shadow-sm panel-enter space-y-2.5"
    >
      {step === "confirm" && (
        <>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid place-items-center w-7 h-7 rounded-lg bg-brand-teal/10 text-brand-teal shrink-0">
              <ShuffleIcon />
            </span>
            <div className="space-y-1">
              <p className="font-semibold text-neutral-900">Redistribuir canchas del evento</p>
              <p className="text-xs panel-label leading-relaxed">
                Reparte parejo, entre las canchas de cada disciplina, todos los partidos sin jugar de{" "}
                <strong className="font-semibold text-neutral-800">todos los torneos</strong> del evento. Los
                que están en juego o ya se jugaron no se tocan.
              </p>
              <p className="text-xs panel-label leading-relaxed">
                Cambian la cancha y el turno de esos partidos: avisales a los jueces.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="flex-1 h-9 rounded-lg panel-button-primary font-medium disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              {pending ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
                    aria-hidden="true"
                  />
                  Redistribuyendo…
                </>
              ) : (
                "Redistribuir"
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              disabled={pending}
              className="flex-1 h-9 rounded-lg panel-button-secondary disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <>
          {result.ok ? (
            <>
              <p className="flex items-center gap-1.5 font-semibold text-brand-green">
                <CheckIcon />
                {result.summary.moved === 0
                  ? "Ya estaba equilibrado: no hubo cambios"
                  : `Listo: ${result.summary.moved} partido${result.summary.moved === 1 ? "" : "s"} reacomodado${
                      result.summary.moved === 1 ? "" : "s"
                    }`}
              </p>
              {result.summary.rows.length === 0 ? (
                <p className="text-xs panel-label">No hay partidos sin jugar para repartir.</p>
              ) : (
                <ul className="space-y-1">
                  {result.summary.rows.map((r) => (
                    <li
                      key={r.disciplines.join("|")}
                      className="flex items-baseline justify-between gap-3 rounded-md bg-neutral-50 border border-neutral-200 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-neutral-800 truncate">{r.disciplines.join(" + ")}</span>
                      <span className="panel-label whitespace-nowrap tabular-nums">
                        {r.matches} en {r.courts} cancha{r.courts === 1 ? "" : "s"} ·{" "}
                        {r.minPerCourt === r.maxPerCourt
                          ? `${r.minPerCourt} c/u`
                          : `${r.minPerCourt}–${r.maxPerCourt} c/u`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-red-600">{result.error}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setResult(null);
            }}
            className="w-full h-8 rounded-lg panel-button-secondary text-xs"
          >
            Cerrar
          </button>
        </>
      )}
    </div>
  );
}
