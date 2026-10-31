"use client";

import { useState, useTransition } from "react";
import { setCompetitionCourts } from "./actions";

export interface CourtChoice {
  id: string;
  label: string;
  /** Es de la disciplina de este torneo (se muestran primero y resaltadas). */
  ownDiscipline: boolean;
}

/** "Canchas de este torneo": casillas con las canchas del evento (las de la
 * disciplina del torneo primero). Ninguna tildada = todas las de la
 * disciplina, como siempre. Guarda en competitions.court_ids. */
export function CompetitionCourtsForm({
  competitionId,
  courts,
  selected,
  started,
}: {
  competitionId: string;
  courts: CourtChoice[];
  selected: string[];
  started: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const own = courts.filter((c) => c.ownDiscipline);
  const others = courts.filter((c) => !c.ownDiscipline);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setCompetitionCourts(competitionId, formData);
        setSaved(true);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  const box = (c: CourtChoice) => (
    <label key={c.id} className="flex items-center gap-2 text-sm rounded-md panel-surface px-3 py-2 cursor-pointer">
      <input type="checkbox" name="court_ids" value={c.id} defaultChecked={selected.includes(c.id)} className="rounded" />
      {c.label}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm panel-label">
        Elegí en qué canchas se juegan los partidos de este torneo (ej.: una categoría en 3 canchas y la otra en 2).
        Si no tildás ninguna, usa todas las canchas de su disciplina.
      </p>
      {courts.length === 0 ? (
        <p className="text-sm panel-label">El evento todavía no tiene canchas.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{own.map(box)}</div>
          {others.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer panel-label">Canchas de otras disciplinas ({others.length})</summary>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2">{others.map(box)}</div>
            </details>
          )}
        </>
      )}
      {started && (
        <p className="text-xs panel-label">
          El torneo ya arrancó: el cambio vale para lo que se agende de acá en más (ej. la fase final). Para mover los
          partidos que ya tienen cancha y no se jugaron, usá &ldquo;Redistribuir canchas&rdquo; en la pestaña Partidos.
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar canchas"}
        </button>
        {saved && !pending && <span className="text-sm text-brand-green font-semibold panel-enter">✓ Guardado</span>}
      </div>
    </form>
  );
}
