import { createAdminClient } from "@/lib/supabase/admin";
import type { Competition, Match } from "@/lib/database.types";
import { JudgeRealtime } from "./judge-realtime";
import { StartMatchButton } from "./start-match-button";
import { MatchTimerPanel } from "./match-timer-panel";
import { KioskInvalidLink } from "@/app/components/kiosk-shell";

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
    return <KioskInvalidLink message="Link de cancha inválido. Pedile el link correcto a la mesa de jueces." />;
  }

  const { data: event } = await supabase.from("events").select("name").eq("id", court.event_id).single();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("court_id", court.id)
    .in("status", ["scheduled", "in_progress"])
    .order("turno", { ascending: true, nullsFirst: false });

  const list = (matches ?? []) as Match[];
  // Una cancha física corre un partido a la vez: si ya hay uno en curso,
  // queda forzado como activo — el juez recién elige entre los pendientes
  // cuando no hay ninguno corriendo.
  const current = list.find((m) => m.status === "in_progress") ?? null;
  const scheduled = list.filter((m) => m.status === "scheduled");

  const teamIds = list.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x);
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  let competition: Competition | null = null;
  if (current) {
    const { data } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", current.competition_id)
      .single<Competition>();
    competition = data ?? null;
  }

  return (
    <div className="panel-page min-h-screen">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <JudgeRealtime courtId={court.id} />

        <header className="py-3 panel-enter">
          <p className="text-sm panel-label truncate">{event?.name}</p>
          <h1 className="text-2xl font-display font-bold tracking-wide truncate">{court.name}</h1>
        </header>
        <div className="panel-brand-stripe" />

        {current && competition ? (
          <MatchTimerPanel
            courtToken={courtToken}
            match={current}
            competition={competition}
            teamAName={teamName.get(current.team_a_id ?? "") ?? "Equipo A"}
            teamBName={teamName.get(current.team_b_id ?? "") ?? "Equipo B"}
          />
        ) : null}

        {current && scheduled.length > 0 && (
          <section className="pt-2">
            <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold mb-2">Después</p>
            <ul className="space-y-1 text-sm panel-label panel-enter-stagger">
              {scheduled.slice(0, 3).map((m) => (
                <li key={m.id}>
                  {teamName.get(m.team_a_id ?? "") ?? "?"} vs {teamName.get(m.team_b_id ?? "") ?? "?"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!current &&
          (scheduled.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
                Elegí qué partido arrancar
              </p>
              <div className="space-y-2 panel-enter-stagger">
                {scheduled.map((m) => (
                  <div key={m.id} className="panel-card rounded-xl p-4 space-y-3">
                    <p className="text-lg font-display font-semibold">
                      {teamName.get(m.team_a_id ?? "") ?? "?"}{" "}
                      <span className="panel-label font-normal">vs</span>{" "}
                      {teamName.get(m.team_b_id ?? "") ?? "?"}
                    </p>
                    {!m.team_a_id || !m.team_b_id ? (
                      <p className="text-sm panel-label">Todavía no están definidos los dos equipos.</p>
                    ) : (
                      <StartMatchButton courtToken={courtToken} matchId={m.id} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-sm panel-label">No hay partidos pendientes asignados a esta cancha.</p>
          ))}
      </div>
    </div>
  );
}
