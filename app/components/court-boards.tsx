import type { CourtBoard } from "@/lib/build-court-boards";
import { MatchClock } from "./match-clock";
import { TeamLabel } from "./team-label";
import { TeamCardBadges } from "./team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";

/** Pantalla pública organizada por cancha (no por torneo): una tarjeta por
 * cancha con el partido en curso — reloj, marcador, pausado si corresponde —
 * y los próximos partidos de esa cancha debajo. Las posiciones y el cuadro
 * de fase final de cada torneo siguen viéndose aparte (HomeDisciplineMenu),
 * esto es solo "qué está pasando ahora, cancha por cancha". */
export function CourtBoards({ boards }: { boards: CourtBoard[] }) {
  if (boards.length === 0) return null;

  return (
    <section className="panel-card rounded-2xl p-4 sm:p-5 space-y-4">
      <h2 className="text-xs font-display font-bold uppercase tracking-wide panel-label">Canchas en vivo</h2>
      <div className="grid sm:grid-cols-2 gap-3 panel-enter-stagger">
        {boards.map((board) => (
          <div
            key={board.courtId}
            className={`rounded-2xl overflow-hidden border-l-4 panel-card ${board.colorBorder} ${board.live ? board.colorBg : ""}`}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] uppercase tracking-wide font-display font-semibold panel-label">
                  {board.courtName}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${board.colorDot}`} aria-hidden="true" />
              </div>

              {board.live ? (
                <div className="space-y-2.5">
                  <p className={`text-base font-display font-bold leading-tight ${board.colorText}`}>
                    {board.live.disciplineCategory}
                  </p>
                  <p className="text-lg font-display font-medium text-center">
                    <TeamLabel name={board.live.teamAName} memberNames={board.live.teamAMemberNames} />{" "}
                    <TeamCardBadges summary={cardsByTeam(board.live.cards, board.live.match.team_a_id, board.live.match.team_b_id).a} />{" "}
                    <span className="panel-label font-normal">vs</span>{" "}
                    <TeamLabel name={board.live.teamBName} memberNames={board.live.teamBMemberNames} />{" "}
                    <TeamCardBadges summary={cardsByTeam(board.live.cards, board.live.match.team_a_id, board.live.match.team_b_id).b} />
                  </p>
                  <MatchClock match={board.live.match} competition={board.live.competition} size="compact" />
                  {board.live.competition.timer_mode === "periods" && (
                    <p className="text-2xl font-mono font-bold text-center tabular-nums">
                      {board.live.match.score_a ?? 0} – {board.live.match.score_b ?? 0}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm panel-label">Sin partido en curso ahora.</p>
              )}
            </div>

            {board.upcoming.length > 0 && (
              <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-2.5 space-y-1">
                <p className="text-[10px] uppercase tracking-wide panel-label font-display font-semibold">
                  Después
                </p>
                {board.upcoming.map((m) => (
                  <p key={m.match.id} className="text-xs panel-label truncate">
                    {m.teamAName} vs {m.teamBName}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
