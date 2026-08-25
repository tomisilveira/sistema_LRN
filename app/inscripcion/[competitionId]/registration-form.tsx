"use client";

import { useState, useTransition } from "react";
import { registerTeam } from "./actions";
import { MemberListInput } from "@/app/components/member-list-input";

// Bases y condiciones de la Liga — el checkbox de abajo es obligatorio y
// linkea acá. Si la organización cambia el documento, alcanza con actualizar
// esta constante.
const TERMS_URL = "https://drive.google.com/file/d/130w9o1tIuDkZAf9w7E5QomN3kYU8_yVc/view?usp=sharing";

export function RegistrationForm({
  competitionId,
  disciplineSlug,
}: {
  competitionId: string;
  // Fútbol robótico es la única disciplina donde el equipo se arma con más
  // de un robot (2 titulares + 1 suplente opcional) — el resto (sumo, mini
  // sumo) el equipo ES un solo robot, así que ahí no tiene sentido pedir
  // "Robot 1/2/3" aparte del nombre del equipo.
  disciplineSlug: string;
}) {
  const isFutbol = disciplineSlug === "futbol";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const teamName = String(formData.get("name") ?? "");

    startTransition(async () => {
      try {
        await registerTeam(competitionId, formData);
        setSubmitted(teamName);
        form.reset();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo registrar el equipo.");
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm panel-label mb-1" htmlFor="name">
          {isFutbol ? "Nombre del equipo *" : "Nombre del robot *"}
        </label>
        <input id="name" name="name" required className="w-full rounded-md panel-input px-3 py-2 text-sm" />
      </div>

      {isFutbol && (
        <div className="rounded-md panel-surface p-3 space-y-2.5">
          <p className="text-sm font-medium">Robots del equipo</p>
          <p className="text-xs panel-label -mt-1.5">
            Opcional — cargalos si ya los tenés armados. Titulares y, si hay, el suplente.
          </p>
          <div>
            <label className="block text-xs panel-label mb-1" htmlFor="robot_1">
              Robot 1 (opcional)
            </label>
            <input id="robot_1" name="robot_1" className="w-full rounded-md panel-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs panel-label mb-1" htmlFor="robot_2">
              Robot 2 (opcional)
            </label>
            <input id="robot_2" name="robot_2" className="w-full rounded-md panel-input px-3 py-2 text-sm" />
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
          Mentor/profesor responsable *
        </label>
        <input
          id="mentor_name"
          name="mentor_name"
          required
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm panel-label mb-1" htmlFor="mentor_phone">
            Celular del mentor *
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
            Email del mentor *
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
      <div>
        <label className="block text-sm panel-label mb-1" htmlFor="member_count">
          Cantidad de integrantes del equipo
        </label>
        <input
          id="member_count"
          name="member_count"
          type="number"
          min={1}
          className="w-32 rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      <MemberListInput label="Integrantes del equipo (opcional)" />
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
          de la Liga Robótica Neuquina. *
        </span>
      </label>

      {error && <p className="text-sm text-red-500 dark:text-red-400 panel-enter">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md panel-button-primary font-medium py-2.5 disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Inscribir equipo"}
      </button>
    </form>
  );
}
