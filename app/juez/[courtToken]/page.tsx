import { createAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/lib/database.types";
import { ResultForm } from "./result-form";
import { JudgeRealtime } from "./judge-realtime";

export const dynamic = "force-dynamic";

export default async function JudgePage({ params }: { params: Promise<{ courtToken: string }> }) {
  const { courtToken } = await params;
  const supabase = createAdminClient();

  const { data: court } = await supabase
    .from("courts")
    .select("id, name, event_id")
    .eq("access_token", courtToken)
    .maybeSingle();

  if (!court) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center bg-neutral-950 text-neutral-100">
        <p>Link de cancha inválido. Pedile el link correcto a la mesa de jueces.</p>
      </main>
    );
  }

  const { data: event } = await supabase.from("events").select("name").eq("id", court.event_id).single();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("court_id", court.id)
    .in("status", ["scheduled", "in_progress"])
    .order("turno", { ascending: true, nullsFirst: false });

  const list = (matches ?? []) as Match[];
  const current = list[0] ?? null;
  const upcoming = list.slice(1, 4);

  const teamIds = list.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x);
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  let allowDraws = true;
  if (current) {
    const { data: competition } = await supabase
      .from("competitions")
      .select("allow_draws")
      .eq("id", current.competition_id)
      .single();
    allowDraws = competition?.allow_draws ?? true;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 max-w-md mx-auto">
      <JudgeRealtime courtId={court.id} />
      <header className="py-4">
        <p className="text-sm text-neutral-500">{event?.name}</p>
        <h1 className="text-xl font-bold">{court.name}</h1>
      </header>

      {current ? (
        <section className="rounded-xl border border-neutral-800 p-4 space-y-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Próximo partido</p>
          <p className="text-lg font-semibold">
            {teamName.get(current.team_a_id ?? "") ?? "?"} vs{" "}
            {teamName.get(current.team_b_id ?? "") ?? "?"}
          </p>
          {current.team_a_id && current.team_b_id ? (
            <ResultForm
              courtToken={courtToken}
              matchId={current.id}
              teamAId={current.team_a_id}
              teamBId={current.team_b_id}
              teamAName={teamName.get(current.team_a_id) ?? "Equipo A"}
              teamBName={teamName.get(current.team_b_id) ?? "Equipo B"}
              allowDraws={allowDraws}
            />
          ) : (
            <p className="text-sm text-neutral-500">Todavía no están definidos los dos equipos.</p>
          )}
        </section>
      ) : (
        <p className="text-neutral-500 text-sm">No hay partidos pendientes asignados a esta cancha.</p>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Después</p>
          <ul className="space-y-1 text-sm text-neutral-400">
            {upcoming.map((m) => (
              <li key={m.id}>
                {teamName.get(m.team_a_id ?? "") ?? "?"} vs {teamName.get(m.team_b_id ?? "") ?? "?"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
