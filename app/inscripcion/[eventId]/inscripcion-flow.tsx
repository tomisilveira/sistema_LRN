"use client";

import { useMemo, useState } from "react";
import { RegistrationForm } from "./registration-form";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineCopy, REGISTRATION_IMPLIES } from "@/lib/registration-copy";

export type OpenCompetition = {
  id: string;
  disciplineSlug: string;
  disciplineName: string;
  disciplineSortOrder: number;
  categorySlug: string;
  categoryName: string;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.2 2.7-5 6.5-5s6.5 1.8 6.5 5" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6M17.5 20c0-2.2-.7-3.8-2-4.9" />
    </svg>
  );
}

/** Desplegable de disciplina → explicación → categoría → formulario, todo en
 * un solo link por evento (ver page.tsx). Solo se ofrecen las disciplinas y
 * categorías con inscripción abierta; si una disciplina tiene un único
 * torneo abierto, su categoría queda pre-elegida. */
export function InscripcionFlow({ competitions }: { competitions: OpenCompetition[] }) {
  const [disciplineSlug, setDisciplineSlug] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // Disciplinas con al menos un torneo abierto (competitions ya viene
  // ordenado por sort_order desde el server).
  const disciplines = useMemo(() => {
    const seen = new Set<string>();
    const out: { slug: string; name: string; sortOrder: number }[] = [];
    for (const c of competitions) {
      if (seen.has(c.disciplineSlug)) continue;
      seen.add(c.disciplineSlug);
      out.push({ slug: c.disciplineSlug, name: c.disciplineName, sortOrder: c.disciplineSortOrder });
    }
    return out;
  }, [competitions]);

  const openCategories = useMemo(
    () => competitions.filter((c) => c.disciplineSlug === disciplineSlug),
    [competitions, disciplineSlug]
  );

  const autoCategory = openCategories.length === 1 ? openCategories[0].categorySlug : null;
  const effectiveCategory = categorySlug ?? autoCategory;

  const discipline = disciplines.find((d) => d.slug === disciplineSlug) ?? null;
  const colors = disciplineColor(discipline ? { sort_order: discipline.sortOrder } : null);
  const copy = disciplineSlug ? disciplineCopy(disciplineSlug) : null;

  const selected =
    disciplineSlug && effectiveCategory
      ? competitions.find(
          (c) => c.disciplineSlug === disciplineSlug && c.categorySlug === effectiveCategory
        ) ?? null
      : null;

  function pickDiscipline(slug: string) {
    setDisciplineSlug(slug || null);
    setCategorySlug(null);
    setStarted(false);
  }

  const openLine =
    disciplines.length === 1
      ? "Hay 1 disciplina con inscripción abierta en esta jornada."
      : `Hay ${disciplines.length} disciplinas con inscripción abierta en esta jornada.`;

  // Ya arrancó el formulario: barra compacta + formulario.
  if (selected && started) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="w-full flex items-center gap-2.5 rounded-xl panel-card px-4 py-3 text-left"
        >
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
          <span className="font-medium text-[15px] truncate">
            {selected.disciplineName} — {selected.categoryName}
          </span>
          <span className="ml-auto text-[13px] text-brand-teal-dark dark:text-brand-teal font-medium shrink-0">
            Cambiar
          </span>
        </button>

        <RegistrationForm
          key={selected.id}
          competitionId={selected.id}
          disciplineSlug={selected.disciplineSlug}
          disciplineLabel={`${selected.disciplineName} — ${selected.categoryName}`}
          colors={colors}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Paso 1 — disciplina */}
      <section className="panel-card rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-200/70">
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0 ${
              disciplineSlug ? `${colors.bg} ${colors.text}` : "bg-neutral-100 dark:bg-neutral-800 panel-label"
            }`}
          >
            1
          </span>
          <span className="font-display font-semibold text-[16px] leading-none">¿A qué te querés inscribir?</span>
        </div>
        <div className="p-4 space-y-2">
          <label className="block text-sm font-semibold panel-label" htmlFor="disciplina">
            Disciplina <span className="text-brand-orange">*</span>
          </label>
          <select
            id="disciplina"
            value={disciplineSlug ?? ""}
            onChange={(e) => pickDiscipline(e.target.value)}
            className="w-full rounded-lg panel-input px-3 h-11 text-base"
          >
            <option value="">Elegí una disciplina…</option>
            {disciplines.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
          <p className="text-[13px] panel-label leading-snug">
            {openLine} Solo aparecen las que tienen la inscripción abierta.
          </p>
        </div>
      </section>

      {copy && discipline && (
        <>
          {/* Explicación de la disciplina */}
          <section className="panel-card rounded-xl overflow-hidden panel-enter">
            <div className={`flex items-center gap-2 px-4 py-3 ${colors.bg} border-b border-neutral-200/60`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
              <span className={`font-display font-semibold text-[15px] ${colors.text}`}>{discipline.name}</span>
            </div>
            <div className="p-4 space-y-3.5 text-[15px]">
              <p className="font-display font-semibold text-[19px] leading-tight">{copy.tagline}</p>
              <p className="text-neutral-700 dark:text-neutral-200 leading-relaxed text-[14px]">{copy.how}</p>

              <div className={`flex items-start gap-2.5 rounded-lg p-3 ${colors.bg}`}>
                <TeamIcon className={`w-[17px] h-[17px] mt-[2px] shrink-0 ${colors.text}`} />
                <p className="text-[13.5px] leading-snug">
                  <span className="font-semibold">Tu equipo:</span> {copy.teamIs}
                </p>
              </div>

              <div>
                <p className={`text-[12px] font-bold uppercase tracking-wider mb-2 ${colors.text}`}>Vas a necesitar</p>
                <ul className="space-y-2">
                  {copy.need.map((n, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckIcon className={`w-4 h-4 mt-[3px] shrink-0 ${colors.text}`} />
                      <span className="text-[14px] leading-snug text-neutral-700 dark:text-neutral-200">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Paso 2 — categoría */}
          <section className="panel-card rounded-xl overflow-hidden panel-enter">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-200/70">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0 ${colors.bg} ${colors.text}`}
              >
                2
              </span>
              <span className="font-display font-semibold text-[16px] leading-none">Categoría</span>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex gap-2">
                {openCategories.map((c) => {
                  const isSel = effectiveCategory === c.categorySlug;
                  return (
                    <button
                      key={c.categorySlug}
                      type="button"
                      onClick={() => setCategorySlug(c.categorySlug)}
                      className={`flex-1 text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        isSel
                          ? `${colors.border} ${colors.bg}`
                          : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      <span className="block font-display font-semibold text-[15px] leading-tight">
                        {c.categoryName}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[13px] panel-label leading-snug">
                {openCategories.length === 1
                  ? "Para esta disciplina hay un solo torneo abierto en la jornada."
                  : "Elegí según la edad de la mayoría del equipo. Ante la duda, escribile a la organización."}
              </p>
            </div>
          </section>
        </>
      )}

      {selected && (
        <div className="space-y-3 panel-enter">
          <div className="panel-card rounded-xl p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider panel-label mb-2">Qué implica inscribirte</p>
            <ul className="space-y-1.5">
              {REGISTRATION_IMPLIES.map((n, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-neutral-400 shrink-0" />
                  <span className="text-[13px] leading-snug panel-label">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="w-full rounded-xl panel-button-primary font-semibold h-12 text-base"
          >
            Continuar a la inscripción
          </button>
        </div>
      )}
    </div>
  );
}
