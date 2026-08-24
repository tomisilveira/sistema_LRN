import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import type { Competition } from "@/lib/database.types";

/** "Torinaoshi": el round actual (sumo/mini sumo, modo 'rounds') terminó
 * empatado — no cuenta para nadie, se repite el mismo round desde cero.
 * A diferencia de round-result, NO toca round_winner_ids ni current_period
 * (sigue siendo el mismo round, no se gasta un cupo de los `periods_count`
 * disponibles) — solo resetea el reloj, igual que arrancar un round nuevo. */
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

  if (match.status !== "in_progress") {
    return NextResponse.json({ error: "Este partido no está en curso." }, { status: 400 });
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("timer_mode")
    .eq("id", match.competition_id)
    .single<Pick<Competition, "timer_mode">>();
  if (competition?.timer_mode !== "rounds") {
    return NextResponse.json({ error: "Esta disciplina no juega por rounds." }, { status: 400 });
  }

  const { error } = await supabase
    .from("matches")
    .update({ timer_elapsed_seconds: 0, timer_running_since: null })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
