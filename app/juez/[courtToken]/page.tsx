import { createAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/lib/database.types";
import { ResultForm } from "./result-form";
import { JudgeRealtime } from "./judge-realtime";
import { StartMatchButton } from "./start-match-button";
import { MatchTimer } from "./match-timer";
import { KioskShell, KioskInvalidLink } from "@/app/components/kiosk-shell";

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
    <KioskShell eyebrow={event?.name} title={court.name}>
      <JudgeRealtime courtId={court.id} />

      {current ? (
        <section className="panel-card rounded-xl p-4 space-y-4 panel-enter">
          <p className="text-xs panel-label uppercase tracking-wide font-medium">Próximo partido</p>
          <p className="text-lg font-semibold">
            {teamName.get(current.team_a_id ?? "") ?? "?"} vs{" "}
            {teamName.get(current.team_b_id ?? "") ?? "?"}
          </p>
          {!current.team_a_id || !current.team_b_id ? (
            <p className="text-sm panel-label">Todavía no están definidos los dos equipos.</p>
          ) : current.status === "scheduled" ? (
            <StartMatchButton courtToken={courtToken} matchId={current.id} />
          ) : (
            <>
              {current.started_at && (
                <MatchTimer courtToken={courtToken} matchId={current.id} startedAt={current.started_at} />
              )}
              <ResultForm
                courtToken={courtToken}
                matchId={current.id}
                teamAId={current.team_a_id}
                teamBId={current.team_b_id}
                teamAName={teamName.get(current.team_a_id) ?? "Equipo A"}
                teamBName={teamName.get(current.team_b_id) ?? "Equipo B"}
                allowDraws={allowDraws}
              />
            </>
          )}
        </section>
      ) : (
        <p className="text-sm panel-label">No hay partidos pendientes asignados a esta cancha.</p>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6">
          <p className="text-xs panel-label uppercase tracking-wide font-medium mb-2">Después</p>
          <ul className="space-y-1 text-sm panel-label panel-enter-stagger">
            {upcoming.map((m) => (
              <li key={m.id}>
                {teamName.get(m.team_a_id ?? "") ?? "?"} vs {teamName.get(m.team_b_id ?? "") ?? "?"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </KioskShell>
  );
}
