import { MemberListInput } from "@/app/components/member-list-input";
import { MAX_TEAM_MEMBERS } from "@/lib/team-limits";

/** Campos de equipo compartidos entre "Agregar equipo"/"Editar equipo" del
 * panel admin y de la mesa de acreditación (sin login) — mismo set de
 * inputs, la única diferencia es si vienen con valor inicial (edición) o
 * vacíos (alta), y si se muestran los datos del responsable adulto
 * (`showMentor`, solo en altas — igual que la inscripción pública). Las
 * validaciones reales viven en lib/team-input.ts (server): 1..4
 * integrantes obligatorios, 2 robots obligatorios en fútbol robótico.
 * Robots solo se muestra para fútbol (ver isFutbol); se prellenan por
 * posición ya que robot_names solo guarda una lista de texto, no cuál era
 * titular 1/2/suplente. */
export function TeamFormFields({
  isFutbol,
  defaults,
  showMentor = false,
  mentorRequired = false,
}: {
  isFutbol: boolean;
  defaults?: {
    name: string;
    institution: string;
    robots: string[];
    memberNames: string | null;
    notes: string;
    mentorName?: string;
  };
  /** Muestra los campos del adulto responsable (mentor/profesor) — mismos
   * que la inscripción pública. Se usa en las altas (acreditación, admin),
   * no en la edición (mentor_contact quedó con formatos mezclados, ver
   * updateTeam). */
  showMentor?: boolean;
  /** Marca esos campos como obligatorios (acreditación — el equipo está
   * presente, igual que en la inscripción pública). */
  mentorRequired?: boolean;
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

      {showMentor && (
        <div className="rounded-md panel-surface p-3 space-y-2.5">
          <p className="text-sm font-medium">
            Responsable adulto{mentorRequired && <span className="text-brand-orange"> *</span>}
          </p>
          <p className="text-xs panel-label -mt-1.5">
            Mayor de edad que responde por el equipo el día del evento. Mismos datos que pide la
            inscripción pública.
          </p>
          <div>
            <label className="block text-xs panel-label mb-1">
              Mentor / profesor responsable{mentorRequired && <span className="text-brand-orange"> *</span>}
            </label>
            <input
              name="mentor_name"
              required={mentorRequired}
              defaultValue={defaults?.mentorName}
              placeholder="Nombre y apellido"
              className="w-full rounded-md panel-input px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs panel-label mb-1">
              Celular{mentorRequired && <span className="text-brand-orange"> *</span>}
            </label>
            <input
              name="mentor_phone"
              type="tel"
              required={mentorRequired}
              placeholder="299 ..."
              className="w-full rounded-md panel-input px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs panel-label mb-1">
              Email{mentorRequired && <span className="text-brand-orange"> *</span>}
            </label>
            <input
              name="mentor_email"
              type="email"
              required={mentorRequired}
              placeholder="mail@ejemplo.com"
              className="w-full rounded-md panel-input px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <MemberListInput
        label="Integrantes"
        required
        max={MAX_TEAM_MEMBERS}
        initialValue={defaults?.memberNames}
        helpText={`Quiénes forman parte del equipo (hasta ${MAX_TEAM_MEMBERS}). Se muestran debajo del nombre y se usan para la premiación.`}
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
