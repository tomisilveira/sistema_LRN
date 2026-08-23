import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";

// Reanuda el reloj del período/ronda actual desde donde quedó
// (timer_elapsed_seconds no se toca, solo se prende timer_running_since).
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

  if (match.status !== "in_progress" || match.timer_running_since) {
    return NextResponse.json({ error: "El reloj no está pausado." }, { status: 400 });
  }

  const { error } = await supabase
    .from("matches")
    .update({ timer_running_since: new Date().toISOString() })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
