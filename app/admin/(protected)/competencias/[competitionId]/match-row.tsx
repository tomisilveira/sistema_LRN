import type { Court, Match, MatchCard } from "@/lib/database.types";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { MatchResultForm } from "./match-result-form";
import { MatchScheduleForm } from "./match-schedule-form";

// Esta página nunca necesita el `access_token` de las canchas (el link del
// juez se copia desde la página del evento) y además pasa la lista a un
// client component — así el token no viaja al browser.
export type CourtOption = Pick<Court, "id" | "name" | "discipline_id" | "sort_order">;

/** Fila de un partido de la fase de grupos (pestaña Partidos): equipos,
 * estado, cancha/turno con override manual y carga de resultado. */
export function MatchRow({
  match,
  teamAName,
  teamBName,
  teamAMemberNames,
  teamBMemberNames,
  cards,
  courts,
  competitionDisciplineId,
  disciplineNameById,
  allowDraws,
  onSchedule,
  onResult,
}: {
  match: Match;
  teamAName: string;
  teamBName: string;
  teamAMemberNames: string | null;
  teamBMemberNames: string | null;
  cards: MatchCard[];
  courts: CourtOption[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  allowDraws: boolean;
  onSchedule: (matchId: string, formData: FormData) => Promise<void>;
  onResult: (formData: FormData) => Promise<void>;
}) {
  const courtName = match.court_id ? courts.find((c) => c.id === match.court_id)?.name : null;
  const teamCards = cardsByTeam(cards, match.team_a_id, match.team_b_id);

  return (
    <div
      className={`rounded-lg px-3 py-2.5 space-y-2.5 text-[15px] transition-colors ${
        match.status === "in_progress"
          ? "bg-brand-orange/5 border border-brand-orange/40"
          : "panel-surface hover:border-brand-teal/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-[180px]">
          <TeamLabel
            name={teamAName}
            memberNames={teamAMemberNames}
            className={match.winner_id === match.team_a_id ? "font-semibold" : ""}
          />{" "}
          <TeamCardBadges summary={teamCards.a} />
          {" vs "}
          <TeamLabel
            name={teamBName}
            memberNames={teamBMemberNames}
            className={match.winner_id === match.team_b_id ? "font-semibold" : ""}
          />{" "}
          <TeamCardBadges summary={teamCards.b} />
          {match.status === "completed" && match.score_a !== null && match.score_b !== null && (
            <span className="panel-label"> · {match.score_a}-{match.score_b}</span>
          )}
          {match.status === "in_progress" && (
            <span className="text-brand-orange font-medium inline-flex items-center gap-1">
              {" · "}
              <span className="panel-live-dot" aria-hidden="true" />
              en curso
            </span>
          )}
        </div>
        {match.status === "completed" ? (
          <span className="panel-chip-success text-xs rounded-full px-2 py-0.5 font-medium shrink-0">
            ✅ Jugado
          </span>
        ) : courtName ? (
          <span className="panel-chip text-xs rounded-full px-2 py-0.5 shrink-0">
            🏟 {courtName}
            {match.turno !== null ? ` · Turno ${match.turno}` : ""}
          </span>
        ) : (
          <span className="panel-chip-warning text-xs rounded-full px-2 py-0.5 shrink-0">
            Sin cancha asignada
          </span>
        )}
      </div>

      {match.status !== "completed" && (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2 pt-2 border-t border-neutral-200">
          {/* Cancha y turno se asignan solos al iniciar el torneo — esto es
              solo para pisar esa asignación a mano si hace falta (ej. una
              cancha se rompe a mitad de la jornada). */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide panel-label shrink-0">Cancha/turno</span>
            <MatchScheduleForm
              matchId={match.id}
              courtId={match.court_id}
              turno={match.turno}
              courts={courts}
              competitionDisciplineId={competitionDisciplineId}
              disciplineNameById={disciplineNameById}
              onSchedule={onSchedule}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide panel-label shrink-0">Resultado</span>
            <MatchResultForm
              action={onResult}
              teamAId={match.team_a_id}
              teamBId={match.team_b_id}
              teamAName={teamAName}
              teamBName={teamBName}
              allowDraws={allowDraws}
            />
          </div>
        </div>
      )}
    </div>
  );
}
