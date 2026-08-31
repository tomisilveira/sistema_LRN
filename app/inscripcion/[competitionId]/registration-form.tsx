"use client";

import { useRef, useState, useTransition } from "react";
import { registerTeam } from "./actions";
import { MemberListInput } from "@/app/components/member-list-input";
import { parseMemberNames } from "@/lib/team-display";
import { MAX_TEAM_MEMBERS } from "@/lib/team-limits";
import { registrationCopy } from "@/lib/registration-copy";

// Bases y condiciones de la Liga — el checkbox de abajo es obligatorio y
// linkea acá. Si la organización cambia el documento, alcanza con actualizar
// esta constante.
const TERMS_URL = "https://drive.google.com/file/d/130w9o1tIuDkZAf9w7E5QomN3kYU8_yVc/view?usp=sharing";

export function RegistrationForm({
  competitionId,
  disciplineSlug,
  disciplineLabel,
}: {
  competitionId: string;
  // Fútbol robótico es la única disciplina donde el equipo se arma con más
  // de un robot (2 titulares + 1 suplente opcional) — el resto (sumo, mini
  // sumo) el equipo ES un solo robot.
  disciplineSlug: string;
  disciplineLabel: string;
}) {
  const isFutbol = disciplineSlug === "futbol";
  const copy = registrationCopy(disciplineSlug);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const teamName = String(formData.get("name") ?? "").trim();

    // Chequeo rápido en el cliente — el server re-valida todo igual
    // (ver actions.ts / lib/team-input.ts).
    const problems: string[] = [];
    if (!teamName) problems.push(isFutbol ? "Falta el nombre del equipo." : "Falta el nombre del robot.");
    if (!String(formData.get("mentor_name") ?? "").trim()) problems.push("Falta el mentor/profesor responsable.");
    if (!String(formData.get("mentor_phone") ?? "").trim()) problems.push("Falta el celular del mentor.");
    const email = String(formData.get("mentor_email") ?? "").trim();
    if (!email || !email.includes("@")) problems.push("Falta un email válido del mentor.");
    if (isFutbol && (!String(formData.get("robot_1") ?? "").trim() || !String(formData.get("robot_2") ?? "").trim())) {
      problems.push("Fútbol robótico necesita los 2 robots titulares.");
    }
    const members = parseMemberNames(String(formData.get("member_names") ?? ""));
    if (members.length < 1) problems.push("Cargá al menos un integrante del equipo.");
    if (members.length > MAX_TEAM_MEMBERS) problems.push(`Máximo ${MAX_TEAM_MEMBERS} integrantes por equipo.`);
    if (formData.get("accepted_terms") !== "on") problems.push("Tenés que aceptar las bases y condiciones.");

    if (problems.length > 0) {
      setFieldErrors(problems);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setFieldErrors([]);

    startTransition(async () => {
      try {
        await registerTeam(competitionId, formData);
        setSubmitted(teamName);
        form.reset();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo registrar el equipo.");
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-brand-green/50 bg-brand-green/10 p-4 space-y-3 panel-enter">
        <p className="font-semibold text-brand-green">¡{submitted} está inscripto! 🎉</p>
        <p className="text-sm panel-label">
          Nos vemos en la jornada. Si necesitás cambiar algo, contactá a la organización.
        </p>
        <button
          onClick={() => setSubmitted(null)}
          className="text-sm panel-label hover:opacity-80 underline"
        >
          Inscribir otro equipo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg panel-surface border-l-4 border-brand-teal/50 p-4 space-y-3 text-sm">
        <div>
          <p className="font-semibold">Te estás inscribiendo a: {disciplineLabel}</p>
          <p className="panel-label mt-1">{copy.what}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="font-medium text-xs uppercase tracking-wide panel-label mb-1">Qué necesitás</p>
            <ul className="list-disc pl-4 space-y-0.5 panel-label">
              {copy.need.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-xs uppercase tracking-wide panel-label mb-1">Qué implica</p>
            <ul className="list-disc pl-4 space-y-0.5 panel-label">
              {copy.implies.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {(fieldErrors.length > 0 || error) && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm panel-enter outline-none"
        >
          <p className="font-semibold text-red-600 dark:text-red-400">Revisá estos puntos:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5 text-red-600 dark:text-red-400">
            {error && <li>{error}</li>}
            {fieldErrors.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm panel-label mb-1" htmlFor="name">
            {isFutbol ? "Nombre del equipo" : "Nombre del robot"} <span className="text-brand-orange">*</span>
          </label>
          <input id="name" name="name" required className="w-full rounded-md panel-input px-3 py-2 text-sm" />
        </div>

        {isFutbol && (
          <div className="rounded-md panel-surface p-3 space-y-2.5">
            <p className="text-sm font-medium">
              Robots del equipo <span className="text-brand-orange">*</span>
            </p>
            <p className="text-xs panel-label -mt-1.5">
              Fútbol robótico se juega con 2 robots titulares. El suplente es opcional.
            </p>
            <div>
              <label className="block text-xs panel-label mb-1" htmlFor="robot_1">
                Robot 1 (titular) <span className="text-brand-orange">*</span>
              </label>
              <input
                id="robot_1"
                name="robot_1"
                required
                className="w-full rounded-md panel-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs panel-label mb-1" htmlFor="robot_2">
                Robot 2 (titular) <span className="text-brand-orange">*</span>
              </label>
              <input
                id="robot_2"
                name="robot_2"
                required
                className="w-full rounded-md panel-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs panel-label mb-1" htmlFor="robot_3">
                Robot suplente (opcional)
              </label>
              <input id="robot_3" name="robot_3" className="w-full rounded-md panel-input px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm panel-label mb-1" htmlFor="institution">
            Institución / escuela
          </label>
          <input id="institution" name="institution" className="w-full rounded-md panel-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm panel-label mb-1" htmlFor="mentor_name">
            Mentor/profesor responsable <span className="text-brand-orange">*</span>
          </label>
          <input
            id="mentor_name"
            name="mentor_name"
            required
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
          <p className="text-xs panel-label mt-1">Persona mayor de edad que responde por el equipo el día del evento.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm panel-label mb-1" htmlFor="mentor_phone">
              Celular del mentor <span className="text-brand-orange">*</span>
            </label>
            <input
              id="mentor_phone"
              name="mentor_phone"
              type="tel"
              required
              className="w-full rounded-md panel-input px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm panel-label mb-1" htmlFor="mentor_email">
              Email del mentor <span className="text-brand-orange">*</span>
            </label>
            <input
              id="mentor_email"
              name="mentor_email"
              type="email"
              required
              className="w-full rounded-md panel-input px-3 py-2 text-sm"
            />
          </div>
        </div>

        <MemberListInput
          label="Integrantes del equipo"
          required
          max={MAX_TEAM_MEMBERS}
          helpText={`Cargá a todas las personas que van a competir (hasta ${MAX_TEAM_MEMBERS}), con nombre y edad. Esta lista se usa para la premiación, así que tiene que coincidir con quienes se presentan.`}
        />

        <div>
          <label className="block text-sm panel-label mb-1" htmlFor="notes">
            Notas (opcional)
          </label>
          <textarea id="notes" name="notes" rows={2} className="w-full rounded-md panel-input px-3 py-2 text-sm" />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="accepted_terms"
            required
            className="mt-0.5 rounded accent-brand-teal w-4 h-4 shrink-0"
          />
          <span>
            Leí y acepto las{" "}
            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-teal-dark dark:text-brand-teal underline hover:opacity-80"
            >
              bases y condiciones
            </a>{" "}
            de la Liga Robótica Neuquina. <span className="text-brand-orange">*</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md panel-button-primary font-medium py-2.5 disabled:opacity-50"
        >
          {pending ? "Enviando..." : "Inscribir equipo"}
        </button>
      </form>
    </div>
  );
}
