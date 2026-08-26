import { MemberListInput } from "@/app/components/member-list-input";

/** Campos de equipo compartidos entre "Agregar equipo"/"Editar equipo" del
 * panel admin y "Editar equipo" de la mesa de acreditación (sin login) —
 * mismo set de inputs, la única diferencia es si vienen con valor inicial
 * (edición) o vacíos (alta). Robots solo se muestra para fútbol robótico
 * (ver isFutbol más abajo); se prellenan por posición ya que robot_names
 * solo guarda una lista de texto, no cuál era titular 1/2/suplente. */
export function TeamFormFields({
  isFutbol,
  defaults,
}: {
  isFutbol: boolean;
  defaults?: {
    name: string;
    institution: string;
    robots: string[];
    memberCount: number | null;
    memberNames: string | null;
    notes: string;
  };
}) {
  const robots = defaults?.robots ?? [];
  return (
    <>
      <div>
        <label className="block text-sm panel-label mb-1">{isFutbol ? "Nombre del equipo" : "Nombre del robot"}</label>
        <input
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder={isFutbol ? "Nombre del equipo" : "Nombre del robot"}
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      {isFutbol && (
        <div className="rounded-md panel-surface p-3 space-y-2.5">
          <p className="text-sm font-medium">Robots del equipo (opcional)</p>
          <input
            name="robot_1"
            defaultValue={robots[0] ?? ""}
            placeholder="Robot 1"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
          <input
            name="robot_2"
            defaultValue={robots[1] ?? ""}
            placeholder="Robot 2"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
          <input
            name="robot_3"
            defaultValue={robots[2] ?? ""}
            placeholder="Robot suplente"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
        </div>
      )}
      <div>
        <label className="block text-sm panel-label mb-1">Institución (opcional)</label>
        <input
          name="institution"
          defaultValue={defaults?.institution}
          placeholder="Institución"
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm panel-label mb-1">Cantidad de integrantes (opcional)</label>
        <input
          name="member_count"
          type="number"
          min={1}
          defaultValue={defaults?.memberCount ?? undefined}
          className="w-32 rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      <MemberListInput
        label="Integrantes (opcional)"
        initialValue={defaults?.memberNames}
        helpText="Se muestran públicamente debajo del nombre del equipo, entre paréntesis."
      />
      <div>
        <label className="block text-sm panel-label mb-1">Notas (opcional)</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaults?.notes}
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
    </>
  );
}
