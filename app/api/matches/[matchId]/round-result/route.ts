import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import { advanceWinner } from "@/lib/bracket-actions";
import { maybeAdvanceCompetitionPhase } from "@/lib/advance-competition-phase";
import { roundWinCounts } from "@/lib/match-timer";
import type { Competition, Match } from "@/lib/database.types";

// Carga el ganador de UN round (modo 'rounds', sumo/mini sumo — mejor de N,
// ver competition.rounds_to_win). Si con este round algún equipo ya llegó a
// rounds_to_win, cierra el partido (mismo cierre que result/route.ts:
// winner_id + score_a/score_b con el conteo de rounds + advanceWinner +
// maybeAdvanceCompetitionPhase). Si no, pasa al siguiente round con el
// reloj reseteado y pausado (el juez lo arranca con /resume cuando estén
// listos los dos robots).
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const { courtToken, roundWinnerId } = (body ?? {}) as {
    courtToken?: string;
    roundWinnerId?: string | null;
  };

  const supabase = createAdminClient();

  let match: Match;
  try {
    match = await assertMatchBelongsToCourt(supabase, matchId, courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (match.status !== "in_progress") {
    return NextResponse.json({ error: "Este partido no está en curso." }, { status: 400 });
  }
  if (!match.team_a_id || !match.team_b_id) {
    return NextResponse.json({ error: "Todavía no están definidos los dos equipos." }, { status: 400 });
  }
  if (roundWinnerId !== match.team_a_id && roundWinnerId !== match.team_b_id) {
    return NextResponse.json({ error: "El ganador del round no pertenece a este partido." }, { status: 400 });
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", match.competition_id)
    .single<Competition>();
  if (!competition) {
    return NextResponse.json({ error: "Competencia no encontrada." }, { status: 404 });
  }
  if (competition.timer_mode !== "rounds" || !competition.rounds_to_win) {
    return NextResponse.json({ error: "Esta disciplina no juega por rounds." }, { status: 400 });
  }

  const roundWinnerIds = [...(match.round_winner_ids ?? []), roundWinnerId];
  const counts = roundWinCounts(roundWinnerIds, match.team_a_id, match.team_b_id);
  const decided = counts.a >= competition.rounds_to_win || counts.b >= competition.rounds_to_win;
  const outOfRounds = roundWinnerIds.length >= competition.periods_count;

  let update;
  if (decided || outOfRounds) {
    const winnerId = counts.a === counts.b ? null : counts.a > counts.b ? match.team_a_id : match.team_b_id;
    update = {
      round_winner_ids: roundWinnerIds,
      score_a: counts.a,
      score_b: counts.b,
      winner_id: winnerId,
      status: "completed" as const,
      timer_running_since: null,
    };
  } else {
    update = {
      round_winner_ids: roundWinnerIds,
      current_period: match.current_period + 1,
      timer_elapsed_seconds: 0,
      timer_running_since: null,
    };
  }

  const { data: updated, error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", matchId)
    .select("*")
    .single<Match>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updated.status === "completed") {
    if (updated.phase === "bracket") {
      await advanceWinner(supabase, updated);
    }
    await maybeAdvanceCompetitionPhase(supabase, updated.competition_id);
  }

  return NextResponse.json({ ok: true, completed: updated.status === "completed" });
}
