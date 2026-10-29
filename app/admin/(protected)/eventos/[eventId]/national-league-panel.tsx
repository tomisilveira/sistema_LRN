"use client";

import { useRef, useState, useTransition } from "react";
import { saveNationalLeague } from "./actions";
import {
  NATIONAL_LEAGUE_DEFAULT_LABELS,
  NATIONAL_LEAGUE_FORM_ROWS,
  nationalLeagueTotals,
  type NationalLeague,
} from "@/lib/national-league";

/** Pestaña "Liga Nacional" del evento: carga manual de los números de la
 * Liga Nacional (se juega en el mismo evento pero no con este sistema) que
 * se muestran en la pantalla del locutor. Una fila por disciplina; las
 * filas sin números no se guardan. */
export function NationalLeaguePanel({ eventId, league }: { eventId: string; league: NationalLeague | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const rows = Array.from({ length: NATIONAL_LEAGUE_FORM_ROWS }, (_, i) => {
    const row = league?.rows[i];
    return row ?? { label: league ? "" : (NATIONAL_LEAGUE_DEFAULT_LABELS[i] ?? ""), teams: null, robots: null, participants: null };
  });
  const totals = league ? nationalLeagueTotals(league) : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveNationalLeague(eventId, formData);
        setSaved(true);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  const numberInput = "w-full rounded-md panel-input px-2 py-1.5 text-sm text-right tabular-nums";

  return (
    <div className="space-y-4">
      <div className="panel-card rounded-xl p-4 space-y-1">
        <h2 className="font-semibold">Liga Nacional</h2>
        <p className="text-sm panel-label">
          Se juega en este evento pero no se maneja con el sistema. Cargá los números acá y aparecen en la{" "}
          <a href={`/evento/${eventId}/locutor`} target="_blank" rel="noreferrer" className="underline">
            pantalla del locutor
          </a>
          . Las filas sin números no se muestran; si dejás todo vacío y guardás, la sección desaparece.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="panel-card rounded-xl p-4 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-xs uppercase tracking-wide panel-label">
                <th className="text-left font-semibold pb-2 pr-2">Disciplina</th>
                <th className="font-semibold pb-2 px-1 w-24">Equipos</th>
                <th className="font-semibold pb-2 px-1 w-24">Robots</th>
                <th className="font-semibold pb-2 pl-1 w-24">Personas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      name={`row_label_${i}`}
                      defaultValue={row.label}
                      placeholder={i < NATIONAL_LEAGUE_DEFAULT_LABELS.length ? NATIONAL_LEAGUE_DEFAULT_LABELS[i] : "Otra disciplina (opcional)"}
                      className="w-full rounded-md panel-input px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <input name={`row_teams_${i}`} type="number" min={0} inputMode="numeric" defaultValue={row.teams ?? ""} className={numberInput} aria-label={`Equipos fila ${i + 1}`} />
                  </td>
                  <td className="py-1 px-1">
                    <input name={`row_robots_${i}`} type="number" min={0} inputMode="numeric" defaultValue={row.robots ?? ""} className={numberInput} aria-label={`Robots fila ${i + 1}`} />
                  </td>
                  <td className="py-1 pl-1">
                    <input name={`row_participants_${i}`} type="number" min={0} inputMode="numeric" defaultValue={row.participants ?? ""} className={numberInput} aria-label={`Personas fila ${i + 1}`} />
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="text-right tabular-nums font-semibold border-t border-neutral-200">
                  <td className="text-left pt-2">Total guardado</td>
                  <td className="pt-2 px-3">{totals.teams ?? "—"}</td>
                  <td className="pt-2 px-3">{totals.robots ?? "—"}</td>
                  <td className="pt-2 px-3">{totals.participants ?? "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide panel-label">Provincias</span>
            <input name="provinces" type="number" min={0} inputMode="numeric" defaultValue={league?.provinces ?? ""} className="w-full rounded-md panel-input px-2 py-1.5 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide panel-label">Nota para el locutor (opcional)</span>
            <input
              name="note"
              defaultValue={league?.note ?? ""}
              placeholder="Ej.: clasifican al Nacional de Córdoba"
              maxLength={200}
              className="w-full rounded-md panel-input px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg panel-button-primary font-display font-semibold px-5 py-2 text-sm disabled:opacity-50">
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {saved && !pending && <span className="text-sm text-brand-green font-semibold panel-enter">✓ Guardado</span>}
        </div>
      </form>
    </div>
  );
}
