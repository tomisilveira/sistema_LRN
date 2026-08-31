import { MemberListInput } from "@/app/components/member-list-input";
import { MAX_TEAM_MEMBERS } from "@/lib/team-limits";

/** Campos de equipo compartidos entre "Agregar equipo"/"Editar equipo" del
 * panel admin y "Editar equipo" de la mesa de acreditación (sin login) —
 * mismo set de inputs, la única diferencia es si vienen con valor inicial
 * (edición) o vacíos (alta). Las validaciones reales viven en
 * lib/team-input.ts (server): 1..4 integrantes obligatorios, 2 robots
 * obligatorios en fútbol robótico. Robots solo se muestra para fútbol
 * (ver isFutbol); se prellenan por posición ya que robot_names solo guarda
 * una lista de texto, no cuál era titular 1/2/suplente. */
export function TeamFormFields({
  isFutbol,
  defaults,
}: {
  isFutbol: boolean;
  defaults?: {
    name: string;
    institution: string;
    robots: string[];
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
          <p className="text-sm font-medium">
            Robots del equipo <span className="text-brand-orange">*</span>
          </p>
          <p className="text-xs panel-label -mt-1.5">Fútbol robótico se juega con 2 robots. El suplente es opcional.</p>
          <input
            name="robot_1"
            required
            defaultValue={robots[0] ?? ""}
            placeholder="Robot 1 (titular)"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
          <input
            name="robot_2"
            required
            defaultValue={robots[1] ?? ""}
            placeholder="Robot 2 (titular)"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
          <input
            name="robot_3"
            defaultValue={robots[2] ?? ""}
            placeholder="Robot suplente (opcional)"
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
      <MemberListInput
        label="Integrantes"
        required
        max={MAX_TEAM_MEMBERS}
        initialValue={defaults?.memberNames}
        helpText={`Todas las personas del equipo (máximo ${MAX_TEAM_MEMBERS}). Se muestran públicamente debajo del nombre y se usan para la premiación.`}
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
