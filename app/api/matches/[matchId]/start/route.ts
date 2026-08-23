import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";

// El juez "abre" el partido cuando los dos equipos están parados en la
// cancha — arranca el cronómetro (started_at) y pasa a 'in_progress'.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const courtToken = (body as { courtToken?: string } | null)?.courtToken;

  const supabase = createAdminClient();

  let match;
  try {
    match = await assertMatchBelongsToCourt(supabase, matchId, courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (match.status !== "scheduled") {
    return NextResponse.json({ error: "Este partido no está esperando para arrancar." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("matches")
    .update({
      status: "in_progress",
      started_at: now,
      // Arranca el reloj pausable del primer período/ronda ya corriendo.
      timer_running_since: now,
      timer_elapsed_seconds: 0,
      current_period: 1,
      round_winner_ids: [],
    })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// "Me equivoqué": si el juez abrió el partido sin querer, lo vuelve a
// 'scheduled' siempre que todavía no se haya cargado ningún resultado.
export async function DELETE(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const courtToken = (body as { courtToken?: string } | null)?.courtToken;

  const supabase = createAdminClient();

  let match;
  try {
    match = await assertMatchBelongsToCourt(supabase, matchId, courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (match.status !== "in_progress") {
    return NextResponse.json({ error: "Este partido no está en curso." }, { status: 400 });
  }

  const { error } = await supabase
    .from("matches")
    .update({
      status: "scheduled",
      started_at: null,
      timer_running_since: null,
      timer_elapsed_seconds: 0,
      current_period: 1,
      round_winner_ids: [],
    })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
