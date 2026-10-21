import type { Court, Match, MatchCard } from "@/lib/database.types";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { roundWinCounts } from "@/lib/match-timer";
import { MatchRowActions } from "./match-row-actions";
import type { MatchActionResult } from "./actions";
import type { ForfeitSide } from "@/lib/database.types";
import { forfeitLabel } from "@/lib/forfeit-rules";

// Esta página nunca necesita el `access_token` de las canchas (el link del
// juez se copia desde la página del evento) y además pasa la lista a un
// client component — así el token no viaja al browser.
export type CourtOption = Pick<Court, "id" | "name" | "discipline_id" | "sort_order">;

/** Tarjeta de un partido de la fase de grupos (pestaña Partidos), tipo
 * marcador: arriba turno/cancha y estado; al medio los dos equipos con su
 * puntaje a la derecha y el ganador resaltado; abajo los botones para
 * cargar/corregir resultado, cambiar cancha/turno y reiniciar — cada uno
 * abre su formulario solo cuando hace falta (oct 2026, antes los campos
 * estaban siempre a la vista y la fila se leía amontonada). */
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
  onReset,
  onForfeit,
  woScore,
  teamAWithdrawn = false,
  teamBWithdrawn = false,
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
  onResult: (formData: FormData) => Promise<MatchActionResult>;
  onReset: () => Promise<MatchActionResult>;
  onForfeit: (side: ForfeitSide) => Promise<MatchActionResult>;
  woScore: number;
  teamAWithdrawn?: boolean;
  teamBWithdrawn?: boolean;
}) {
  const courtName = match.court_id ? courts.find((c) => c.id === match.court_id)?.name : null;
  const teamCards = cardsByTeam(cards, match.team_a_id, match.team_b_id);
  const played = match.status === "completed";
  const live = match.status === "in_progress";
  // En vivo: fútbol guarda el marcador parcial en score_a/score_b; sumo
  // solo los ganadores de cada round (round_winner_ids).
  const liveRounds = live && (match.round_winner_ids ?? []).length > 0
    ? roundWinCounts(match.round_winner_ids, match.team_a_id, match.team_b_id)
    : null;
  const scoreA = liveRounds ? liveRounds.a : played || live ? match.score_a : null;
  const scoreB = liveRounds ? liveRounds.b : played || live ? match.score_b : null;

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden transition-colors ${
        live ? "border-brand-orange/60 shadow-sm" : played ? "border-neutral-200" : "border-neutral-200 hover:border-brand-teal/40"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs border-b ${
          live ? "bg-brand-orange/8 border-brand-orange/30" : "bg-neutral-50 border-neutral-200"
        }`}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          {match.turno !== null && <span className="font-semibold text-neutral-700">Turno {match.turno}</span>}
          {courtName ? (
            <span className="panel-label">· {courtName}</span>
          ) : (
            !played && <span className="panel-chip-warning rounded-full px-2 py-0.5">Sin cancha</span>
          )}
        </span>
        {played && match.forfeit ? (
          <span className="panel-chip-warning rounded-full px-2 py-0.5 font-medium" title={forfeitLabel(match.forfeit, teamAName, teamBName) ?? ""}>
            W.O. · {forfeitLabel(match.forfeit, teamAName, teamBName)}
          </span>
        ) : played ? (
          <span className="panel-chip-success rounded-full px-2 py-0.5 font-medium">✓ Jugado</span>
        ) : live ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange">
            <span className="panel-live-dot" aria-hidden="true" />
            En curso
          </span>
        ) : (
          <span className="panel-label">Por jugar</span>
        )}
      </div>

      <div className="px-3 py-2 divide-y divide-neutral-100">
        <TeamScoreLine
          name={teamAName}
          memberNames={teamAMemberNames}
          cardSummary={teamCards.a}
          score={scoreA}
          won={played && match.winner_id !== null && match.winner_id === match.team_a_id}
          lost={played && match.winner_id !== null && match.winner_id !== match.team_a_id}
          withdrawn={teamAWithdrawn}
        />
        <TeamScoreLine
          name={teamBName}
          memberNames={teamBMemberNames}
          cardSummary={teamCards.b}
          score={scoreB}
          won={played && match.winner_id !== null && match.winner_id === match.team_b_id}
          lost={played && match.winner_id !== null && match.winner_id !== match.team_b_id}
          withdrawn={teamBWithdrawn}
        />
      </div>

      <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50/60">
        <MatchRowActions
          status={match.status}
          matchId={match.id}
          teamAId={match.team_a_id}
          teamBId={match.team_b_id}
          teamAName={teamAName}
          teamBName={teamBName}
          scoreA={match.score_a}
          scoreB={match.score_b}
          allowDraws={allowDraws}
          courtId={match.court_id}
          turno={match.turno}
          courts={courts}
          competitionDisciplineId={competitionDisciplineId}
          disciplineNameById={disciplineNameById}
          onSchedule={onSchedule}
          onResult={onResult}
          onReset={onReset}
          onForfeit={onForfeit}
          woScore={woScore}
        />
      </div>
    </div>
  );
}

function TeamScoreLine({
  name,
  memberNames,
  cardSummary,
  score,
  won,
  lost,
  withdrawn,
}: {
  name: string;
  memberNames: string | null;
  cardSummary: ReturnType<typeof cardsByTeam>["a"];
  score: number | null;
  won: boolean;
  lost: boolean;
  withdrawn: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className={`min-w-0 text-[15px] ${won ? "font-semibold text-brand-green" : lost ? "text-neutral-500" : ""}`}>
        {won && <span aria-label="Ganador">🏆 </span>}
        <TeamLabel name={name} memberNames={memberNames} /> <TeamCardBadges summary={cardSummary} />
        {withdrawn && <WithdrawnBadge />}
      </div>
      <span
        className={`shrink-0 w-9 text-center font-display font-bold text-xl tabular-nums rounded-md py-0.5 ${
          score === null
            ? "text-neutral-300"
            : won
              ? "bg-brand-green/12 text-brand-green"
              : "text-neutral-700"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

/** Etiqueta de equipo dado de baja (robot roto, no compite más). */
export function WithdrawnBadge() {
  return (
    <span
      className="ml-1 align-middle text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-neutral-200 text-neutral-600"
      title="Dado de baja: no compite más"
    >
      Baja
    </span>
  );
}
