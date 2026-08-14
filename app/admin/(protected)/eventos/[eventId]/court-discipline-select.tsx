"use client";

import { useTransition } from "react";
import { setCourtDiscipline } from "./actions";

/** Guarda sola al cambiar, mismo patrón que GroupAssignSelect (competencias) —
 * antes era un <select> + botón "Guardar" con defaultValue, que en React
 * solo se aplica en el montaje inicial: después de guardar y revalidar la
 * página, el select no reflejaba necesariamente el valor nuevo, y encima
 * el botón de guardar era un texto gris casi invisible al lado de un
 * select con color de fondo. Sacamos las dos cosas de un saque. */
export function CourtDisciplineSelect({
  eventId,
  courtId,
  disciplineId,
  disciplines,
}: {
  eventId: string;
  courtId: string;
  disciplineId: string | null;
  disciplines: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={disciplineId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("discipline_id", e.target.value);
        startTransition(() => {
          setCourtDiscipline(eventId, courtId, formData);
        });
      }}
      className="flex-1 rounded panel-input px-1.5 py-1 text-xs disabled:opacity-50"
    >
      <option value="">Sin disciplina asignada</option>
      {disciplines.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
