import { createAdminClient } from "@/lib/supabase/admin";
import type { Team } from "@/lib/database.types";
import { TeamCheckinRow } from "./team-checkin-row";

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
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center bg-neutral-950 text-neutral-100">
        <p>Link de acreditación inválido. Pedile el link correcto a la organización.</p>
      </main>
    );
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

  const totalPresent = teamsList.reduce((sum, t) => sum + (t.participants_present ?? 0), 0);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 max-w-2xl mx-auto">
      <header className="py-4">
        <p className="text-sm text-neutral-500">{event.name}</p>
        <h1 className="text-xl font-bold">Acreditación</h1>
      </header>

      {competitionList.length === 0 && (
        <p className="text-sm text-neutral-500">Todavía no hay torneos cargados en este evento.</p>
      )}

      <div className="space-y-6">
        {competitionList.map((c) => {
          const list = teamsByCompetition.get(c.id) ?? [];
          return (
            <section key={c.id}>
              <h2 className="text-sm font-semibold text-brand-teal uppercase tracking-wide mb-2">
                {c.disciplines?.name} — {c.categories?.name}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-neutral-600">Sin equipos inscriptos todavía.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((t) => (
                    <TeamCheckinRow key={t.id} eventToken={eventToken} team={t} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="mt-8 pt-4 border-t border-neutral-800 text-sm text-neutral-400">
        Total participantes presentes:{" "}
        <span className="font-semibold text-brand-orange text-base">{totalPresent}</span>
      </footer>
    </main>
  );
}
