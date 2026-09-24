"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setCompetitionRegistration } from "./actions";

/** Llave abrir/cerrar inscripción de un torneo. Optimista: cambia al toque
 * y, si el servidor rechaza, vuelve atrás y muestra el error. */
export function RegistrationSwitch({
  eventId,
  competitionId,
  open,
  label,
  disabled = false,
}: {
  eventId: string;
  competitionId: string;
  open: boolean;
  /** Nombre del torneo, para el lector de pantalla. */
  label: string;
  disabled?: boolean;
}) {
  const [optimisticOpen, setOptimisticOpen] = useOptimistic(open);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimisticOpen;
    setError(null);
    startTransition(async () => {
      setOptimisticOpen(next);
      try {
        await setCompetitionRegistration(eventId, competitionId, next);
      } catch {
        setError("No se pudo cambiar. Probá de nuevo.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        role="switch"
        aria-checked={optimisticOpen}
        aria-label={`Inscripción de ${label}`}
        onClick={toggle}
        disabled={disabled || pending}
        className="group inline-flex items-center gap-2 rounded-full h-9 pl-1 pr-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
      >
        <span
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
            optimisticOpen ? "bg-brand-green" : "bg-neutral-300"
          }`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              optimisticOpen ? "translate-x-4" : ""
            }`}
          />
        </span>
        <span className={`w-[4.5rem] text-left ${optimisticOpen ? "text-brand-green" : "panel-label"}`}>
          {optimisticOpen ? "Abierta" : "Cerrada"}
        </span>
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
