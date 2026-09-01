import { createAdminClient } from "@/lib/supabase/admin";
import type { Team } from "@/lib/database.types";
import { AccreditationBoard, type AccreditationGroup } from "./accreditation-board";
import { KioskShell, KioskInvalidLink } from "@/app/components/kiosk-shell";
import { disciplineCategoryLabel } from "@/lib/discipline-display";
import { disciplineColor } from "@/lib/discipline-colors";

export const dynamic = "force-dynamic";

export default async function AcreditacionPage({ params }: { params: Promise<{ eventToken: string }> }) {
  const { eventToken } = await params;
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("accreditation_token", eventToken)
    .maybeSingle();

  if (!event) {
    return <KioskInvalidLink message="Link de acreditación inválido. Pedile el link correcto a la organización." />;
  }

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, status, disciplines(name, slug, sort_order), categories(name)")
    .eq("event_id", event.id);

  const competitionList = (competitions ?? []) as unknown as {
    id: string;
    status: string;
    disciplines: { name: string; slug: string; sort_order: number } | null;
    categories: { name: string } | null;
  }[];
  const competitionIds = competitionList.map((c) => c.id);

  const { data: teams } = competitionIds.length
    ? await supabase.from("teams").select("*").in("competition_id", competitionIds).order("name")
    : { data: [] as Team[] };
  const teamsList = (teams ?? []) as Team[];

  const teamsByCompetition = new Map<string, Team[]>();
  for (const t of teamsList) {
    const list = teamsByCompetition.get(t.competition_id) ?? [];
    list.push(t);
    teamsByCompetition.set(t.competition_id, list);
  }

  // Mismo criterio que competencias/[competitionId]/page.tsx: solo se puede
  // mover un equipo a un torneo del evento que TODAVÍA esté en "setup" (sin
  // fixture armado) — uno que ya arrancó no tiene dónde meter un equipo
  // nuevo. No se restringe a la misma disciplina (un equipo puede haberse
  // anotado en la disciplina que no era), se marca con crossDiscipline para
  // avisar del tema de robot_names (solo tiene sentido en fútbol).
  const groups: AccreditationGroup[] = competitionList.map((c) => ({
    id: c.id,
    label: disciplineCategoryLabel(c.disciplines, c.categories),
    teams: teamsByCompetition.get(c.id) ?? [],
    isFutbol: c.disciplines?.slug === "futbol",
    colors: disciplineColor(c.disciplines),
    canMove: c.status === "setup",
    moveTargets: competitionList
      .filter((other) => other.id !== c.id && other.status === "setup")
      .map((other) => ({
        id: other.id,
        label: disciplineCategoryLabel(other.disciplines, other.categories),
        crossDiscipline: other.disciplines?.name !== c.disciplines?.name,
      })),
  }));

  const totalPresent = teamsList.reduce((sum, t) => sum + (t.participants_present ?? 0), 0);

  return (
    <KioskShell eyebrow={event.name} title="Acreditación" maxWidthClassName="max-w-2xl">
      {competitionList.length === 0 ? (
        <p className="text-sm panel-label">Todavía no hay torneos cargados en este evento.</p>
      ) : (
        <AccreditationBoard eventToken={eventToken} groups={groups} />
      )}

      <footer className="mt-6 pt-4 border-t border-neutral-200/70 dark:border-neutral-800 text-[14px] panel-label">
        Total participantes presentes:{" "}
        <span className="font-display font-bold text-brand-orange text-[17px]">{totalPresent}</span>
      </footer>
    </KioskShell>
  );
}
