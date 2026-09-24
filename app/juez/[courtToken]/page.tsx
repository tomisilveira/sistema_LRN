import { createAdminClient } from "@/lib/supabase/admin";
import type { Competition, Match, MatchCard, Team } from "@/lib/database.types";
import { JudgeRealtime } from "./judge-realtime";
import { StartMatchButton } from "./start-match-button";
import { MatchTimerPanel } from "./match-timer-panel";
import { KioskInvalidLink } from "@/app/components/kiosk-shell";
import { TeamLabel } from "@/app/components/team-label";
import { courtDisplayName } from "@/lib/court-display";
import { matchStage } from "@/lib/match-stage";
import { MatchStageChip } from "@/app/components/match-stage-chip";

export const dynamic = "force-dynamic";

export default async function JudgePage({ params }: { params: Promise<{ courtToken: string }> }) {
  const { courtToken } = await params;
  const supabase = createAdminClient();

  // Velocidad (sep 2026): cada botón del juez termina recargando esta
  // página, así que importa cuántas consultas van en fila (~75 ms c/u).
  // Tanda 1: la cancha (con evento y disciplina embebidos) y sus partidos
  // — los partidos se buscan por el token de la cancha con un inner join,
  // sin esperar a tener el id. Tanda 2: todo lo demás en paralelo. Antes
  // eran 5 tandas en fila.
  const [{ data: courtRow }, { data: matches }] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, event_id, discipline_id, events(name), disciplines(name)")
      .eq("access_token", courtToken)
      .maybeSingle<{
        id: string;
        name: string;
        event_id: string;
        discipline_id: string | null;
        events: { name: string } | null;
        disciplines: { name: string } | null;
      }>(),
    supabase
      .from("matches")
      .select("*, courts!inner(access_token)")
      .eq("courts.access_token", courtToken)
      .in("status", ["scheduled", "in_progress"])
      .order("turno", { ascending: true, nullsFirst: false }),
  ]);

  if (!courtRow) {
    return <KioskInvalidLink message="Link de cancha inválido. Pedile el link correcto a la mesa de jueces." />;
  }
  const court = courtRow;
  const event = courtRow.events;
  const discipline = courtRow.disciplines;

  // `courts` embebido solo sirvió para filtrar por token — se descarta.
  // (Se saca antes de pasar los partidos a componentes de cliente.)
  const list = ((matches ?? []) as Record<string, unknown>[]).map((row) => {
    const m = { ...row };
    delete m.courts;
    return m as unknown as Match;
  });
  // Una cancha física corre un partido a la vez: si ya hay uno en curso,
  // queda forzado como activo — el juez recién elige entre los pendientes
  // cuando no hay ninguno corriendo.
  const current = list.find((m) => m.status === "in_progress") ?? null;
  const scheduled = list.filter((m) => m.status === "scheduled");

  const teamIds = [...new Set(list.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x))];
  // Instancia de cada partido (grupo / ronda / 3er puesto / final) — la
  // cancha puede tener partidos de más de un torneo en la cola.
  const groupIds = [...new Set(list.map((m) => m.group_id).filter((x): x is string => !!x))];
  const competitionIds = [...new Set(list.map((m) => m.competition_id))];
  const [{ data: teams }, { data: groupsData }, { data: competitionsData }, { data: cardsData }] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name, member_names").in("id", teamIds)
      : Promise.resolve({ data: [] as Pick<Team, "id" | "name" | "member_names">[] }),
    groupIds.length
      ? supabase.from("groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    // Todos los torneos de la cola (para la instancia oro/plata) — incluye
    // el del partido en curso, que antes se pedía aparte al final.
    competitionIds.length
      ? supabase.from("competitions").select("*").in("id", competitionIds)
      : Promise.resolve({ data: [] as Competition[] }),
    current
      ? supabase.from("match_cards").select("*").eq("match_id", current.id).order("created_at")
      : Promise.resolve({ data: [] as MatchCard[] }),
  ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const groupNameById = new Map((groupsData ?? []).map((g) => [g.id, g.name]));
  const competitionById = new Map(((competitionsData ?? []) as Competition[]).map((c) => [c.id, c]));
  const stageOf = (m: Match) =>
    matchStage(m, {
      groupName: m.group_id ? groupNameById.get(m.group_id) : null,
      goldSilver: competitionById.get(m.competition_id)?.format_type === "gold_silver",
    });

  const competition: Competition | null = current ? (competitionById.get(current.competition_id) ?? null) : null;
  const currentCards = (cardsData ?? []) as MatchCard[];

  return (
    <div className="panel-page min-h-screen">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <JudgeRealtime courtId={court.id} />

        <header className="py-3 panel-enter">
          <p className="text-sm panel-label truncate">{event?.name}</p>
          <h1 className="text-2xl font-display font-bold tracking-wide truncate">
            {courtDisplayName(court.name, discipline)}
          </h1>
        </header>
        <div className="panel-brand-stripe" />

        {current && competition ? (
          <MatchTimerPanel
            courtToken={courtToken}
            match={current}
            competition={competition}
            teamAName={teamName.get(current.team_a_id ?? "") ?? "Equipo A"}
            teamBName={teamName.get(current.team_b_id ?? "") ?? "Equipo B"}
            teamAMemberNames={teamById.get(current.team_a_id ?? "")?.member_names ?? null}
            teamBMemberNames={teamById.get(current.team_b_id ?? "")?.member_names ?? null}
            cards={currentCards}
            stage={stageOf(current)}
          />
        ) : null}

        {current && scheduled.length > 0 && (
          <section className="pt-2">
            <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold mb-2">Después</p>
            <ul className="space-y-1 text-sm panel-label panel-enter-stagger">
              {scheduled.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-center gap-2 min-w-0">
                  <span className="truncate">
                    {teamName.get(m.team_a_id ?? "") ?? "?"} vs {teamName.get(m.team_b_id ?? "") ?? "?"}
                  </span>
                  <MatchStageChip stage={stageOf(m)} size="xs" className="shrink-0" />
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
                    <MatchStageChip stage={stageOf(m)} />
                    <p className="text-xl font-display font-semibold">
                      <TeamLabel name={teamName.get(m.team_a_id ?? "") ?? "?"} memberNames={teamById.get(m.team_a_id ?? "")?.member_names} />{" "}
                      <span className="panel-label font-normal">vs</span>{" "}
                      <TeamLabel name={teamName.get(m.team_b_id ?? "") ?? "?"} memberNames={teamById.get(m.team_b_id ?? "")?.member_names} />
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
