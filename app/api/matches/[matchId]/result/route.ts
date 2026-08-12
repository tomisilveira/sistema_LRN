import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeMatchOutcome } from "@/lib/match-logic";
import { advanceWinner } from "@/lib/bracket-actions";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import { maybeAdvanceCompetitionPhase } from "@/lib/advance-competition-phase";
import type { Competition, Match } from "@/lib/database.types";

// Endpoint que usa el juez de cancha (sin sesión de Supabase Auth) para
// cargar el resultado de un partido. La única credencial es el access_token
// de su cancha; acá se valida contra la DB con la service-role key antes de
// escribir nada.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { courtToken, scoreA, scoreB, winnerId } = body as {
    courtToken?: string;
    scoreA?: number | null;
    scoreB?: number | null;
    winnerId?: string | null;
  };

  const supabase = createAdminClient();

  let match: Match;
  try {
    match = await assertMatchBelongsToCourt(supabase, matchId, courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  if (!match.team_a_id || !match.team_b_id) {
    return NextResponse.json({ error: "Todavía no están definidos los dos equipos." }, { status: 400 });
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", match.competition_id)
    .single<Competition>();
  if (!competition) {
    return NextResponse.json({ error: "Competencia no encontrada." }, { status: 404 });
  }

  let outcome;
  try {
    outcome = computeMatchOutcome({
      allowDraws: competition.allow_draws,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreA: typeof scoreA === "number" ? scoreA : null,
      scoreB: typeof scoreB === "number" ? scoreB : null,
      winnerIdIfNoScore: winnerId ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("matches")
    .update({
      score_a: typeof scoreA === "number" ? scoreA : null,
      score_b: typeof scoreB === "number" ? scoreB : null,
      winner_id: outcome.winner_id,
      status: outcome.status,
    })
    .eq("id", matchId)
    .select("*")
    .single<Match>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updated.phase === "bracket") {
    await advanceWinner(supabase, updated);
  }
  await maybeAdvanceCompetitionPhase(supabase, updated.competition_id);

  return NextResponse.json({ ok: true });
}
