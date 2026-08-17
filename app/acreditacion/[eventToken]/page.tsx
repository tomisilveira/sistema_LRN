import { createAdminClient } from "@/lib/supabase/admin";
import type { Team } from "@/lib/database.types";
import { AccreditationBoard, type AccreditationGroup } from "./accreditation-board";
import { KioskShell, KioskInvalidLink } from "@/app/components/kiosk-shell";

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
    .select("id, disciplines(name), categories(name)")
    .eq("event_id", event.id);

  const competitionList = (competitions ?? []) as unknown as {
    id: string;
    disciplines: { name: string } | null;
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

  const groups: AccreditationGroup[] = competitionList.map((c) => ({
    id: c.id,
    label: `${c.disciplines?.name ?? ""} — ${c.categories?.name ?? ""}`,
    teams: teamsByCompetition.get(c.id) ?? [],
  }));

  const totalPresent = teamsList.reduce((sum, t) => sum + (t.participants_present ?? 0), 0);

  return (
    <KioskShell eyebrow={event.name} title="Acreditación" maxWidthClassName="max-w-2xl">
      {competitionList.length === 0 ? (
        <p className="text-sm panel-label">Todavía no hay torneos cargados en este evento.</p>
      ) : (
        <AccreditationBoard eventToken={eventToken} groups={groups} />
      )}

      <footer className="mt-8 pt-4 panel-nav border-t text-sm panel-label">
        Total participantes presentes:{" "}
        <span className="font-semibold text-brand-orange text-base">{totalPresent}</span>
      </footer>
    </KioskShell>
  );
}
