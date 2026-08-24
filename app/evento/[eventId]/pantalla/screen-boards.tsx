import type { CourtBoard } from "@/lib/build-court-boards";
import { MatchClock } from "@/app/components/match-clock";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { GoalFlash } from "./goal-flash";

/** Grilla grande para Modo Pantalla — mismo dato que CourtBoards
 * (buildCourtBoards) pero con tipografía pensada para leerse de lejos
 * (proyector/TV), reloj en tamaño "hero" y el efecto de gol en el
 * marcador de fútbol. El caller ya filtra `boards` a solo las canchas con
 * partido en vivo (ver page.tsx) — acá no hace falta el estado "sin
 * partido en curso", eso lo cubre screen-fallback.tsx. */
export function ScreenBoards({ boards }: { boards: CourtBoard[] }) {
  const cols = boards.length >= 3 ? "lg:grid-cols-3" : boards.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${cols} panel-enter-stagger`}>
      {boards.map((board) => (
        <div key={board.courtId} className={`panel-card rounded-2xl overflow-hidden border-l-8 ${board.colorBorder} ${board.colorBg}`}>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide font-display font-semibold panel-label">
                {board.courtName}
              </span>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${board.colorDot}`} aria-hidden="true" />
            </div>

            {board.live ? (
              <div className="space-y-3">
                <p className={`text-2xl font-display font-extrabold leading-tight ${board.colorText}`}>
                  {board.live.disciplineCategory}
                </p>
                <p className="text-lg font-display font-medium text-center">
                  <TeamLabel name={board.live.teamAName} memberNames={board.live.teamAMemberNames} />{" "}
                  <TeamCardBadges summary={cardsByTeam(board.live.cards, board.live.match.team_a_id, board.live.match.team_b_id).a} />{" "}
                  <span className="panel-label font-normal text-base">vs</span>{" "}
                  <TeamLabel name={board.live.teamBName} memberNames={board.live.teamBMemberNames} />{" "}
                  <TeamCardBadges summary={cardsByTeam(board.live.cards, board.live.match.team_a_id, board.live.match.team_b_id).b} />
                </p>
                <div className="flex justify-center">
                  <MatchClock match={board.live.match} competition={board.live.competition} size="hero" />
                </div>
                {board.live.competition.timer_mode === "periods" && (
                  <GoalFlash scoreA={board.live.match.score_a ?? 0} scoreB={board.live.match.score_b ?? 0}>
                    <p className="text-5xl font-mono font-bold text-center tabular-nums">
                      {board.live.match.score_a ?? 0} – {board.live.match.score_b ?? 0}
                    </p>
                  </GoalFlash>
                )}
              </div>
            ) : (
              <p className="text-base panel-label py-6 text-center">Sin partido en curso ahora.</p>
            )}
          </div>

          {board.upcoming.length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 space-y-1">
              <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">Después</p>
              {board.upcoming.map((m) => (
                <p key={m.match.id} className="text-sm panel-label truncate">
                  {m.teamAName} vs {m.teamBName}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
