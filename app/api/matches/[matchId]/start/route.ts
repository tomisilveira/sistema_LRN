import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";

// El juez "abre" el partido cuando los dos equipos están parados en la
// cancha — pasa a 'in_progress' y marca started_at, pero el reloj queda
// pausado en 0 (timer_running_since null): recién arranca a contar cuando
// el juez toca "Iniciar partido" en el panel (POST /resume, ver
// match-timer-panel.tsx e isStopped en lib/match-timer.ts) — antes se
// arrancaba solo acá, lo que hacía que el reloj ya estuviera corriendo
// apenas se entraba al partido, antes de que los equipos estuvieran
// realmente listos.
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
      // El reloj arranca pausado en 0 — el juez lo pone en marcha a mano
      // con "Iniciar partido" (ver comentario arriba).
      timer_running_since: null,
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
