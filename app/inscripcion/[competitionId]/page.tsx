import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Discipline, Category } from "@/lib/database.types";
import { RegistrationForm } from "./registration-form";

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

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <p className="text-sm text-neutral-500">{event?.name}</p>
          <h1 className="text-2xl font-bold mt-1">
            {discipline?.name} — {category?.name}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Inscripción de equipos</p>
        </div>

        {competition.registration_open ? (
          <RegistrationForm competitionId={competitionId} />
        ) : (
          <p className="text-sm text-neutral-500 rounded-lg border border-neutral-800 p-4">
            Las inscripciones para este torneo están cerradas por ahora. Consultá con la
            organización de la Liga Robótica Neuquina.
          </p>
        )}
      </div>
    </main>
  );
}
