import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Discipline, Category } from "@/lib/database.types";
import { RegistrationForm } from "./registration-form";
import { KioskShell } from "@/app/components/kiosk-shell";
import { disciplineCategoryLabel } from "@/lib/discipline-display";

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

  // La inscripción tardía está permitida mientras el torneo esté en curso —
  // el admin reabre `registration_open` a mano y después usa "Armar partidos
  // que falten" para sumar a los nuevos al fixture. Sólo un torneo ya
  // terminado no acepta equipos (mismo criterio en registerTeam, ver actions.ts).
  const alreadyFinished = competition.status === "finished";
  const effectivelyOpen = competition.registration_open && !alreadyFinished;

  return (
    <KioskShell
      eyebrow={event?.name}
      title={disciplineCategoryLabel(discipline, category)}
      subtitle="Inscripción de equipos"
    >
      <div className="space-y-6">
        {effectivelyOpen ? (
          <RegistrationForm
            competitionId={competitionId}
            disciplineSlug={discipline?.slug ?? ""}
            disciplineLabel={disciplineCategoryLabel(discipline, category)}
          />
        ) : (
          <p className="text-sm panel-label panel-surface rounded-lg p-4">
            {alreadyFinished
              ? "Este torneo ya terminó, así que las inscripciones están cerradas."
              : "Las inscripciones para este torneo están cerradas por ahora. Consultá con la organización de la Liga Robótica Neuquina."}
          </p>
        )}
      </div>
    </KioskShell>
  );
}
