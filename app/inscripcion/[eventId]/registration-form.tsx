"use client";

import { useRef, useState, useTransition } from "react";
import { registerTeam } from "./actions";
import { MemberListInput } from "@/app/components/member-list-input";
import { parseMemberNames } from "@/lib/team-display";
import { MAX_TEAM_MEMBERS } from "@/lib/team-limits";
import type { DisciplineColorSet } from "@/lib/discipline-colors";

// Bases y condiciones de la Liga — el checkbox de abajo es obligatorio y
// linkea acá. Si la organización cambia el documento, alcanza con actualizar
// esta constante.
const TERMS_URL = "https://drive.google.com/file/d/130w9o1tIuDkZAf9w7E5QomN3kYU8_yVc/view?usp=sharing";

const svgProps = {
  fill: "none",
  stroke: "currentColor" as const,
  strokeWidth: 1.85,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}
function RobotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps} aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 8V5M9 3h6" />
      <circle cx="9.5" cy="13" r="1.2" />
      <circle cx="14.5" cy="13" r="1.2" />
      <path d="M9 19v2M15 19v2" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps} aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function RegistrationForm({
  competitionId,
  disciplineSlug,
  disciplineLabel,
  colors,
}: {
  competitionId: string;
  // Fútbol robótico es la única disciplina donde el equipo se arma con más
  // de un robot (2 titulares + 1 suplente opcional) — el resto (sumo, mini
  // sumo) el equipo ES un solo robot.
  disciplineSlug: string;
  disciplineLabel: string;
  colors: DisciplineColorSet;
}) {
  const isFutbol = disciplineSlug === "futbol";
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
      <div className="panel-enter space-y-4">
        <div className="rounded-2xl border border-brand-green/40 bg-white dark:bg-neutral-900 p-6 text-center space-y-3 shadow-[0_12px_28px_-14px_rgba(94,176,70,0.35)]">
          <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/15 flex items-center justify-center ring-8 ring-brand-green/[0.07]">
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-brand-green to-green-700">
              <CheckIcon className="w-6 h-6" />
            </span>
          </div>
          <h2 className="font-display font-bold text-[22px] leading-tight">¡{submitted} quedó inscripto!</h2>
          <p className="text-[15px] panel-label leading-relaxed">
            Ya está en la lista para{" "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{disciplineLabel}</span>. Nos
            vemos en la jornada.
          </p>
        </div>

        <div className="panel-card rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-200/70">
            <ClockIcon className="w-[18px] h-[18px] text-brand-teal-dark dark:text-brand-teal" />
            <span className="font-display font-semibold text-[16px]">Qué sigue</span>
          </div>
          <div className="p-4 space-y-3 text-[15px]">
            <p className="text-neutral-700 dark:text-neutral-200 leading-snug">
              Llevá {isFutbol ? "los robots" : "el robot"} a{" "}
              <span className="font-semibold">homologación técnica</span> el día del evento, antes de tu
              primer partido.
            </p>
            <p className="text-neutral-700 dark:text-neutral-200 leading-snug">
              Seguí el cronograma y los resultados en la <span className="font-semibold">pantalla del evento</span>.
            </p>
            <p className="text-neutral-700 dark:text-neutral-200 leading-snug">
              ¿Cambió algo del equipo? Escribile a la organización de la Liga.
            </p>
          </div>
        </div>

        <button
          onClick={() => setSubmitted(null)}
          className="w-full rounded-xl panel-button-primary font-semibold h-12 text-base"
        >
          Inscribir otro equipo
        </button>
      </div>
    );
  }

  const sectionHeader = (n: number, title: string, right?: React.ReactNode) => (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-200/70">
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0 ${colors.bg} ${colors.text}`}
      >
        {n}
      </span>
      <span className="font-display font-semibold text-[16px] leading-none">{title}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      {(fieldErrors.length > 0 || error) && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-red-500/50 bg-red-500/10 p-3.5 text-[14px] panel-enter outline-none"
        >
          <p className="font-bold text-red-600 dark:text-red-400">Revisá estos puntos:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5 text-red-600 dark:text-red-400">
            {error && <li>{error}</li>}
            {fieldErrors.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1 — Tu equipo / Tu robot */}
        <section className="panel-card rounded-xl overflow-hidden">
          {sectionHeader(1, isFutbol ? "Tu equipo" : "Tu robot")}
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold panel-label" htmlFor="name">
                {isFutbol ? "Nombre del equipo" : "Nombre del robot"} <span className="text-brand-orange">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full rounded-lg panel-input px-3 h-11 text-base"
                placeholder={isFutbol ? "Ej. Los Ninjabots" : "Ej. Topadora"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold panel-label" htmlFor="institution">
                Institución / escuela <span className="font-normal text-neutral-400">· opcional</span>
              </label>
              <input
                id="institution"
                name="institution"
                className="w-full rounded-lg panel-input px-3 h-11 text-base"
                placeholder="Ej. IPET 20 — Neuquén"
              />
            </div>

            {isFutbol && (
              <div className="border-t border-neutral-200/70 pt-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <RobotIcon className={`w-[17px] h-[17px] ${colors.text}`} />
                  <span className="font-display font-semibold text-[15px]">Robots del equipo</span>
                  <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wide panel-chip-warning rounded-full px-2 py-0.5">
                    Obligatorio
                  </span>
                </div>
                <p className="text-[13px] panel-label mb-3">
                  Fútbol robótico se juega con 2 robots titulares. El suplente es opcional.
                </p>
                <div className="space-y-2.5">
                  {[
                    { name: "robot_1", label: "Robot 1 · titular", required: true, slot: "1" },
                    { name: "robot_2", label: "Robot 2 · titular", required: true, slot: "2" },
                    { name: "robot_3", label: "Robot suplente", required: false, slot: null },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center gap-2.5">
                      <span
                        className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 font-display font-bold text-sm ${
                          r.slot ? `${colors.bg} ${colors.text}` : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {r.slot ?? <RobotIcon className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 space-y-1">
                        <label className="block text-[13px] font-semibold panel-label" htmlFor={r.name}>
                          {r.label}{" "}
                          {r.required ? (
                            <span className="text-brand-orange">*</span>
                          ) : (
                            <span className="font-normal text-neutral-400">· opcional</span>
                          )}
                        </label>
                        <input
                          id={r.name}
                          name={r.name}
                          required={r.required}
                          className="w-full rounded-lg panel-input px-3 h-11 text-base"
                          placeholder={r.slot ? `Nombre del robot ${r.slot}` : "Nombre del robot suplente"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 2 — Responsable adulto */}
        <section className="panel-card rounded-xl overflow-hidden">
          {sectionHeader(2, "Responsable adulto")}
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold panel-label" htmlFor="mentor_name">
                Mentor / profesor responsable <span className="text-brand-orange">*</span>
              </label>
              <input
                id="mentor_name"
                name="mentor_name"
                required
                className="w-full rounded-lg panel-input px-3 h-11 text-base"
                placeholder="Nombre y apellido"
              />
              <p className="text-[13px] panel-label">
                Persona <span className="font-semibold text-neutral-600 dark:text-neutral-300">mayor de edad</span>{" "}
                que responde por el equipo el día del evento.
              </p>
            </div>
            <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold panel-label" htmlFor="mentor_phone">
                  Celular <span className="text-brand-orange">*</span>
                </label>
                <div className="relative">
                  <PhoneIcon className="w-[15px] h-[15px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="mentor_phone"
                    name="mentor_phone"
                    type="tel"
                    required
                    className="w-full rounded-lg panel-input pl-8 pr-3 h-11 text-base"
                    placeholder="299 ..."
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold panel-label" htmlFor="mentor_email">
                  Email <span className="text-brand-orange">*</span>
                </label>
                <div className="relative">
                  <MailIcon className="w-[15px] h-[15px] text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="mentor_email"
                    name="mentor_email"
                    type="email"
                    required
                    className="w-full rounded-lg panel-input pl-8 pr-3 h-11 text-base"
                    placeholder="mail@ejemplo.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 — Integrantes */}
        <section className="panel-card rounded-xl overflow-hidden">
          {sectionHeader(
            3,
            "Integrantes",
            <span className="font-display font-bold text-xs tracking-wide panel-chip rounded-full px-2.5 py-1">
              hasta {MAX_TEAM_MEMBERS}
            </span>
          )}
          <div className="p-4">
            <MemberListInput
              label="Personas del equipo"
              required
              max={MAX_TEAM_MEMBERS}
              helpText={`Quiénes forman parte del equipo (hasta ${MAX_TEAM_MEMBERS}), con nombre y edad. Los nombres se usan para la premiación, así que tienen que coincidir con quienes se presentan.`}
            />
          </div>
        </section>

        {/* 4 — Confirmación */}
        <section className="panel-card rounded-xl overflow-hidden">
          {sectionHeader(4, "Confirmación")}
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold panel-label" htmlFor="notes">
                Notas para la organización <span className="font-normal text-neutral-400">· opcional</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="w-full rounded-lg panel-input px-3 py-2.5 text-base"
                placeholder="Algo que la organización deba saber"
              />
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-brand-teal/30 bg-brand-teal/[0.05] p-3 cursor-pointer text-[14px]">
              <input
                type="checkbox"
                name="accepted_terms"
                required
                className="mt-0.5 rounded accent-brand-teal w-5 h-5 shrink-0"
              />
              <span className="leading-relaxed text-neutral-700 dark:text-neutral-300">
                Leí y acepto las{" "}
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-teal-dark dark:text-brand-teal underline hover:opacity-80 font-medium"
                >
                  bases y condiciones
                </a>{" "}
                de la Liga Robótica Neuquina. <span className="text-brand-orange">*</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl panel-button-primary font-semibold h-12 text-base disabled:opacity-50"
            >
              {pending ? "Enviando..." : "Inscribir equipo"}
            </button>
            <p className="text-center text-[13px] text-neutral-400">Vas a poder inscribir otro equipo después de enviar.</p>
          </div>
        </section>
      </form>
    </div>
  );
}
