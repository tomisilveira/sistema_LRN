import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import type { Competition } from "@/lib/database.types";

// Cierra el período actual (modo 'periods', fútbol). Si quedan períodos,
// pasa al siguiente con el reloj reseteado y pausado (el juez lo arranca
// con /resume). Si era el último, solo pausa el reloj y deja el partido
// listo para el cierre final por el flujo existente (/result, sin tocarlo)
// — el marcador acumulado ya quedó cargado vía /live-score.
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
    .select("*")
    .eq("id", match.competition_id)
    .single<Competition>();
  if (!competition) {
    return NextResponse.json({ error: "Competencia no encontrada." }, { status: 404 });
  }

  const isLastPeriod = match.current_period >= competition.periods_count;
  const { error } = await supabase
    .from("matches")
    .update(
      isLastPeriod
        ? { timer_running_since: null }
        : { current_period: match.current_period + 1, timer_elapsed_seconds: 0, timer_running_since: null }
    )
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, isLastPeriod });
}
