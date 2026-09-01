import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Discipline, Category } from "@/lib/database.types";
import { RegistrationForm } from "./registration-form";
import { KioskShell } from "@/app/components/kiosk-shell";
import { disciplineCategoryLabel } from "@/lib/discipline-display";
import { disciplineColor } from "@/lib/discipline-colors";

export const revalidate = 0;

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .maybeSingle<Competition>();
  if (!competition) notFound();

  const [{ data: discipline }, { data: category }, { data: event }] = await Promise.all([
    supabase.from("disciplines").select("*").eq("id", competition.discipline_id).single<Discipline>(),
    supabase.from("categories").select("*").eq("id", competition.category_id).single<Category>(),
    supabase.from("events").select("name").eq("id", competition.event_id).single(),
  ]);

  const label = disciplineCategoryLabel(discipline, category);
  const colors = disciplineColor(discipline);

  // La inscripción tardía está permitida mientras el torneo esté en curso —
  // el admin reabre `registration_open` a mano y después usa "Armar partidos
  // que falten" para sumar a los nuevos al fixture. Sólo un torneo ya
  // terminado no acepta equipos (mismo criterio en registerTeam, ver actions.ts).
  const alreadyFinished = competition.status === "finished";
  const effectivelyOpen = competition.registration_open && !alreadyFinished;

  return (
    <KioskShell
      eyebrow={event?.name}
      title={label}
      subtitle="Inscripción de equipos"
      titleDot={colors.dot}
    >
      {effectivelyOpen ? (
        <RegistrationForm
          competitionId={competitionId}
          disciplineSlug={discipline?.slug ?? ""}
          disciplineLabel={label}
          colors={colors}
        />
      ) : (
        <RegistrationClosed label={label} finished={alreadyFinished} />
      )}
    </KioskShell>
  );
}

function RegistrationClosed({ label, finished }: { label: string; finished: boolean }) {
  return (
    <div className="panel-enter space-y-4">
      <div className="panel-card rounded-2xl overflow-hidden">
        <div className="px-5 py-6 text-center space-y-2.5">
          <div className="mx-auto w-14 h-14 rounded-full bg-brand-orange/15 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-brand-orange"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl leading-tight">Inscripción cerrada</h2>
          <p className="text-sm panel-label leading-relaxed">
            {finished ? (
              <>
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span> ya terminó, así
                que las inscripciones están cerradas.
              </>
            ) : (
              <>
                Las inscripciones para{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span> están cerradas
                por ahora.
              </>
            )}
          </p>
        </div>
        <div className="border-t border-neutral-200/70 p-4 bg-neutral-50 dark:bg-neutral-950">
          <p className="text-sm panel-label leading-relaxed">
            ¿Necesitás anotar un equipo o corregir datos? Escribile a la organización de la Liga Robótica
            Neuquina.
          </p>
        </div>
      </div>
    </div>
  );
}
