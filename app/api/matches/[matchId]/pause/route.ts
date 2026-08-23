import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import { elapsedSeconds } from "@/lib/match-timer";

// Congela el reloj del período/ronda actual: acumula lo transcurrido en
// timer_elapsed_seconds y apaga timer_running_since. Ver lib/match-timer.ts
// para la fórmula (misma que usan los componentes de cliente).
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

  if (match.status !== "in_progress" || !match.timer_running_since) {
    return NextResponse.json({ error: "El reloj no está corriendo." }, { status: 400 });
  }

  const { error } = await supabase
    .from("matches")
    .update({
      timer_elapsed_seconds: Math.floor(elapsedSeconds(match)),
      timer_running_since: null,
    })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
