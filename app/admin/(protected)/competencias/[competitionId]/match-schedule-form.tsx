"use client";

import { useState, useTransition } from "react";
import type { Court } from "@/lib/database.types";

/** Override manual de cancha/turno de un partido — cancha y turno ya se
 * asignan solos al iniciar el torneo (ver lib/auto-schedule.ts); esto es
 * para pisarlo a mano si hace falta (ej. una cancha se rompe a mitad de
 * jornada). Guarda solo al cambiar la cancha o al perder el foco del turno,
 * mismo patrón que GroupAssignSelect — antes era un form con un botón
 * "Guardar" de texto gris que no se leía como botón. */
export function MatchScheduleForm({
  matchId,
  courtId,
  turno,
  courts,
  competitionDisciplineId,
  disciplineNameById,
  onSchedule,
}: {
  matchId: string;
  courtId: string | null;
  turno: number | null;
  courts: Court[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  onSchedule: (matchId: string, formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(nextCourtId: string, nextTurno: string) {
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("court_id", nextCourtId);
    formData.set("turno", nextTurno);
    startTransition(async () => {
      try {
        await onSchedule(matchId, formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        setError((err as Error).message ?? "No se pudo reasignar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <select
          defaultValue={courtId ?? ""}
          disabled={pending}
          title="Cancha"
          className="rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
          onChange={(e) => {
            const turnoInput = e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
              'input[name="turno"]'
            );
            save(e.target.value, turnoInput?.value.trim() ?? "");
          }}
        >
          <option value="">Sin cancha</option>
          {courts.map((c) => {
            const otherDiscipline =
              c.discipline_id && c.discipline_id !== competitionDisciplineId
                ? disciplineNameById.get(c.discipline_id)
                : null;
            return (
              <option key={c.id} value={c.id}>
                {c.name}
                {otherDiscipline ? ` (⚠ ${otherDiscipline})` : ""}
              </option>
            );
          })}
        </select>
        <input
          name="turno"
          type="number"
          placeholder="Turno"
          defaultValue={turno ?? ""}
          disabled={pending}
          title="Turno"
          className="w-16 rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
          onBlur={(e) => {
            const courtSelect = e.currentTarget.parentElement?.querySelector<HTMLSelectElement>("select");
            save(courtSelect?.value ?? "", e.currentTarget.value.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <span className="w-3.5 text-xs shrink-0" aria-live="polite">
          {pending ? "…" : saved ? <span className="text-brand-green panel-enter">✓</span> : null}
        </span>
      </div>
      {error && <span className="text-xs text-red-500 dark:text-red-400 panel-enter">{error}</span>}
    </div>
  );
}
