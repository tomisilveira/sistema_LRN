"use client";

import { useState, useTransition } from "react";
import { registerTeam } from "./actions";

export function RegistrationForm({ competitionId }: { competitionId: string }) {
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
      <div className="rounded-lg border border-brand-green/50 bg-brand-green/10 p-4 space-y-3">
        <p className="font-semibold text-brand-green">¡{submitted} está inscripto! 🎉</p>
        <p className="text-sm text-neutral-400">
          Nos vemos en la jornada. Si necesitás cambiar algo, contactá a la organización.
        </p>
        <button
          onClick={() => setSubmitted(null)}
          className="text-sm text-neutral-400 hover:text-neutral-100 underline"
        >
          Inscribir otro equipo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="name">
          Nombre del equipo *
        </label>
        <input
          id="name"
          name="name"
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="institution">
          Institución / escuela
        </label>
        <input
          id="institution"
          name="institution"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-1" htmlFor="mentor_name">
            Mentor/profesor responsable *
          </label>
          <input
            id="mentor_name"
            name="mentor_name"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1" htmlFor="mentor_contact">
            Contacto del mentor (email o tel) *
          </label>
          <input
            id="mentor_contact"
            name="mentor_contact"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="member_count">
          Cantidad de integrantes del equipo
        </label>
        <input
          id="member_count"
          name="member_count"
          type="number"
          min={1}
          className="w-32 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="notes">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-teal text-white font-medium py-2.5 transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
      >
        {pending ? "Enviando..." : "Inscribir equipo"}
      </button>
      <p className="text-xs text-neutral-600">
        No pidas datos de menores acá — solo del adulto responsable del equipo.
      </p>
    </form>
  );
}
