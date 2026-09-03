import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KioskShell } from "@/app/components/kiosk-shell";
import { disciplineDisplayName } from "@/lib/discipline-display";
import { InscripcionFlow, type OpenCompetition } from "./inscripcion-flow";

export const revalidate = 0;

type CompetitionRow = {
  id: string;
  status: string;
  disciplines: { slug: string; name: string; sort_order: number } | null;
  categories: { slug: string; name: string; sort_order: number } | null;
};

/** Un solo link de inscripción por evento. El equipo elige la disciplina en
 * un desplegable (solo aparecen las que tienen inscripción abierta), se le
 * explica de qué se trata, elige la categoría (solo las abiertas para esa
 * disciplina) y recién ahí completa el formulario de siempre.
 *
 * Antes había un link por torneo (`/inscripcion/<competitionId>`); se
 * unificó para no compartir varios links a la vez. Los links viejos siguen
 * andando: si el id es de una competencia, redirige al link de su evento. */
export default async function InscripcionPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  // Misma postura que la versión anterior: cliente anon + RLS. La inscripción
  // funciona para eventos públicos (el caso normal — `is_public` arranca en
  // true). Un evento marcado privado no acepta inscripción por este link
  // hasta que se publique.
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .maybeSingle<{ id: string; name: string }>();

  if (!event) {
    const { data: comp } = await supabase
      .from("competitions")
      .select("event_id")
      .eq("id", eventId)
      .maybeSingle<{ event_id: string }>();
    if (comp) redirect(`/inscripcion/${comp.event_id}`);
    notFound();
  }

  // Torneos con inscripción abierta. La inscripción tardía está permitida
  // mientras el torneo esté en curso (el admin reabre `registration_open` a
  // mano); solo un torneo ya terminado queda afuera.
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, status, disciplines(slug, name, sort_order), categories(slug, name, sort_order)")
    .eq("event_id", event.id)
    .eq("registration_open", true)
    .neq("status", "finished")
    .order("created_at");

  const open: OpenCompetition[] = ((competitions ?? []) as unknown as CompetitionRow[])
    .filter((c) => c.disciplines && c.categories)
    .map((c) => ({
      id: c.id,
      disciplineSlug: c.disciplines!.slug,
      disciplineName: disciplineDisplayName(c.disciplines!.name),
      disciplineSortOrder: c.disciplines!.sort_order,
      categorySlug: c.categories!.slug,
      categoryName: c.categories!.name,
    }))
    .sort(
      (a, b) =>
        a.disciplineSortOrder - b.disciplineSortOrder ||
        a.disciplineName.localeCompare(b.disciplineName) ||
        a.categoryName.localeCompare(b.categoryName)
    );

  return (
    <KioskShell eyebrow={event.name} title="Inscripción de equipos" subtitle="Un solo link para todos los torneos del día.">
      {open.length === 0 ? (
        <RegistrationClosed />
      ) : (
        <InscripcionFlow competitions={open} />
      )}
    </KioskShell>
  );
}

function RegistrationClosed() {
  return (
    <div className="panel-enter">
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
          <h2 className="font-display font-bold text-[22px] leading-tight">No hay inscripciones abiertas</h2>
          <p className="text-[15px] panel-label leading-relaxed">
            Todavía no hay ningún torneo de esta jornada con la inscripción abierta.
          </p>
        </div>
        <div className="border-t border-neutral-200/70 p-4 bg-neutral-50 dark:bg-neutral-950">
          <p className="text-[15px] panel-label leading-relaxed">
            ¿Necesitás anotar un equipo o corregir datos? Escribile a la organización de la Liga Robótica
            Neuquina.
          </p>
        </div>
      </div>
    </div>
  );
}
