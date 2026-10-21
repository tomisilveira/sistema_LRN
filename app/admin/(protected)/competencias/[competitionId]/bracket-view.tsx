import type { Match, MatchCard } from "@/lib/database.types";
import { assignSchedule, forfeitMatch, resetMatch, submitResultChecked } from "./actions";
import { ForfeitToggle } from "./forfeit-panel";
import { WithdrawnBadge } from "./match-row";
import { forfeitLabel } from "@/lib/forfeit-rules";
import type { CourtOption } from "./match-row";
import { MatchResultForm } from "./match-result-form";
import { MatchAdminControls } from "./match-admin-controls";
import { MatchScheduleForm } from "./match-schedule-form";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { roundName } from "@/lib/match-stage";

export interface BracketDisplayMatch extends Match {
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_member_names: string | null;
  team_b_member_names: string | null;
  cards: MatchCard[];
}

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F", "3P"];

export function BracketView({
  competitionId,
  matches,
  courts,
  competitionDisciplineId,
  disciplineNameById,
  allowDraws,
  woScore,
  withdrawnTeamIds = [],
}: {
  competitionId: string;
  matches: BracketDisplayMatch[];
  courts: CourtOption[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  allowDraws: boolean;
  /** Goles/rounds del W.O. (fútbol 3, sumo 2). */
  woScore: number;
  /** Equipos dados de baja (robot roto), para la etiqueta BAJA. */
  withdrawnTeamIds?: string[];
}) {
  const withdrawn = new Set(withdrawnTeamIds);
  const byRound = new Map<string, BracketDisplayMatch[]>();
  for (const m of matches) {
    const key = m.round ?? "?";
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key)!.push(m);
  }
  const rounds = [...byRound.entries()]
    .sort(([a], [b]) => {
      const ia = ROUND_ORDER.indexOf(a);
      const ib = ROUND_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([round, ms]) => [round, ms.sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))] as const);

  const schedule = assignSchedule.bind(null, competitionId);

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
      {rounds.map(([round, ms], ri) => {
        const isThird = round === "3P";
        return (
        <div key={round} className="flex flex-col min-w-[230px]">
          <p
            className={`text-xs font-semibold uppercase tracking-wide text-center pb-2 mb-2 border-b-2 ${
              isThird
                ? "text-brand-orange border-brand-orange/40"
                : "text-brand-teal-dark border-brand-teal/30"
            }`}
          >
            {isThird && "🥉 "}
            {roundName(round)}
          </p>
          <div
            className="flex-1 flex flex-col justify-center"
            style={{ gap: isThird ? "1.1rem" : `${Math.pow(2, ri) * 1.1}rem` }}
          >
            {ms.map((m) => {
              const decided = m.status === "completed";
              const bothTeams = !!(m.team_a_name && m.team_b_name);
              // La final espera a que se juegue el 3er puesto: tiene sus dos
              // finalistas pero sigue en 'pending_teams'.
              const finalWaitingForThird = m.round === "F" && bothTeams && m.status === "pending_teams";
              // Cerrado con un solo equipo: pase directo (ronda 1 con menos
              // equipos que lugares) o 3er puesto sin rival (cuadro de 3).
              const noRival = decided && !bothTeams;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl panel-card p-3 space-y-2 border-l-4 transition-colors duration-300 panel-enter ${
                    decided ? "border-brand-green" : "border-neutral-300"
                  }`}
                >
                  <TeamLine
                    name={m.team_a_name}
                    memberNames={m.team_a_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_a_id}
                    emptyLabel={decided ? "Sin rival" : "Por definir"}
                    score={m.score_a}
                    cardSummary={m.team_a_id ? cardsByTeam(m.cards, m.team_a_id, m.team_b_id).a : null}
                    withdrawn={!!m.team_a_id && withdrawn.has(m.team_a_id)}
                  />
                  <TeamLine
                    name={m.team_b_name}
                    memberNames={m.team_b_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_b_id}
                    emptyLabel={decided ? "Sin rival" : "Por definir"}
                    score={m.score_b}
                    cardSummary={m.team_b_id ? cardsByTeam(m.cards, m.team_a_id, m.team_b_id).b : null}
                    withdrawn={!!m.team_b_id && withdrawn.has(m.team_b_id)}
                  />
                  {decided && m.forfeit ? (
                    <>
                      <p className="text-[10px] font-semibold text-brand-orange">
                        W.O. · {forfeitLabel(m.forfeit, m.team_a_name ?? "?", m.team_b_name ?? "?")}
                        {!m.winner_id && " — nadie avanza"}
                      </p>
                      {bothTeams && (
                        <MatchAdminControls
                          played
                          layout="stacked"
                          correctAction={submitResultChecked.bind(null, competitionId, m.id)}
                          resetAction={resetMatch.bind(null, competitionId, m.id)}
                          teamAId={m.team_a_id}
                          teamBId={m.team_b_id}
                          teamAName={m.team_a_name ?? "A"}
                          teamBName={m.team_b_name ?? "B"}
                          allowDraws={allowDraws}
                          knockout
                          scoreA={m.score_a}
                          scoreB={m.score_b}
                        />
                      )}
                    </>
                  ) : noRival ? (
                    <p className="text-[10px] panel-label">
                      {m.round === "3P"
                        ? "3º directo: la otra semifinal fue un pase directo, no hubo rival"
                        : "Pasa directo, sin rival"}
                    </p>
                  ) : decided ? (
                    <>
                      <p className="text-[10px] panel-label">✅ Jugado</p>
                      <MatchAdminControls
                        played
                        layout="stacked"
                        correctAction={submitResultChecked.bind(null, competitionId, m.id)}
                        resetAction={resetMatch.bind(null, competitionId, m.id)}
                        teamAId={m.team_a_id}
                        teamBId={m.team_b_id}
                        teamAName={m.team_a_name ?? "A"}
                        teamBName={m.team_b_name ?? "B"}
                        allowDraws={allowDraws}
                        knockout
                        scoreA={m.score_a}
                        scoreB={m.score_b}
                      />
                    </>
                  ) : finalWaitingForThird ? (
                    <p className="text-[10px] text-brand-orange">⏳ Primero se juega el 3er puesto</p>
                  ) : bothTeams ? (
                    <div className="space-y-1.5">
                      {m.status === "in_progress" && (
                        <p className="text-[10px] text-brand-orange font-medium inline-flex items-center gap-1">
                          <span className="panel-live-dot" aria-hidden="true" /> En curso
                        </p>
                      )}
                      <MatchResultForm
                        layout="stacked"
                        action={submitResultChecked.bind(null, competitionId, m.id)}
                        teamAId={m.team_a_id}
                        teamBId={m.team_b_id}
                        teamAName={m.team_a_name ?? "A"}
                        teamBName={m.team_b_name ?? "B"}
                        allowDraws={allowDraws}
                        knockout
                        submitLabel="Guardar resultado"
                      />
                      <ForfeitToggle
                        teamAName={m.team_a_name ?? "A"}
                        teamBName={m.team_b_name ?? "B"}
                        woScore={woScore}
                        knockout
                        onForfeit={forfeitMatch.bind(null, competitionId, m.id)}
                      />
                      {m.status === "in_progress" && (
                        <MatchAdminControls
                          played={false}
                          correctAction={submitResultChecked.bind(null, competitionId, m.id)}
                          resetAction={resetMatch.bind(null, competitionId, m.id)}
                          teamAId={m.team_a_id}
                          teamBId={m.team_b_id}
                          teamAName={m.team_a_name ?? "A"}
                          teamBName={m.team_b_name ?? "B"}
                          allowDraws={allowDraws}
                          knockout
                          scoreA={m.score_a}
                          scoreB={m.score_b}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] panel-label opacity-70">Esperando clasificados</p>
                  )}
                  {!decided && (
                    // Cancha/turno se asignan solos al generar el cuadro; esto
                    // es para cambiarlos a mano (ej. jugar la final en la
                    // cancha central). Se puede antes de que estén los dos
                    // equipos, para dejar la final ya ubicada.
                    <div className="pt-2 border-t border-neutral-200 space-y-1">
                      <span className="text-[10px] uppercase tracking-wide panel-label">Cancha/turno</span>
                      <MatchScheduleForm
                        matchId={m.id}
                        courtId={m.court_id}
                        turno={m.turno}
                        courts={courts}
                        competitionDisciplineId={competitionDisciplineId}
                        disciplineNameById={disciplineNameById}
                        onSchedule={schedule}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function TeamLine({
  name,
  memberNames,
  won,
  emptyLabel = "Por definir",
  score,
  cardSummary,
  withdrawn = false,
}: {
  name: string | null;
  memberNames: string | null;
  won: boolean;
  emptyLabel?: string;
  score: number | null;
  cardSummary?: ReturnType<typeof cardsByTeam>["a"];
  withdrawn?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-2 text-base ${won ? "font-semibold text-brand-green" : "panel-label"}`}>
      <span className="truncate">
        {won && "🏆 "}
        {name ? <TeamLabel name={name} memberNames={memberNames} /> : <span className="italic opacity-70">{emptyLabel}</span>}{" "}
        <TeamCardBadges summary={cardSummary} />
        {withdrawn && <WithdrawnBadge />}
      </span>
      {score !== null && <span className="shrink-0 ml-2">{score}</span>}
    </div>
  );
}

