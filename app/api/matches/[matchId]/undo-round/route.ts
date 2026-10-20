import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchWithCompetition, JudgeAuthError } from "@/lib/judge-auth";
import type { Competition } from "@/lib/database.types";

/** Deshace el ÚLTIMO round cargado (sumo/mini sumo, modo 'rounds') de un
 * partido todavía en curso: saca el último ganador de round_winner_ids y
 * vuelve al round anterior con el reloj en cero y pausado. Es la forma de
 * arreglar un toque en el botón equivocado desde la cancha — el round que
 * cierra el partido se confirma antes (ver match-timer-panel.tsx), así que
 * mientras el partido sigue en curso todavía se puede corregir. */
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const courtToken = (body as { courtToken?: string } | null)?.courtToken;

  const supabase = createAdminClient();

  let match;
  let competition: Pick<Competition, "timer_mode">;
  try {
    ({ match, competition } = await assertMatchWithCompetition(supabase, matchId, courtToken));
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (match.status !== "in_progress") {
    return NextResponse.json({ error: "Este partido no está en curso." }, { status: 400 });
  }
  if (competition?.timer_mode !== "rounds") {
    return NextResponse.json({ error: "Esta disciplina no juega por rounds." }, { status: 400 });
  }
  const rounds = match.round_winner_ids ?? [];
  if (rounds.length === 0) {
    return NextResponse.json({ error: "Todavía no hay rounds cargados." }, { status: 400 });
  }

  const { error } = await supabase
    .from("matches")
    .update({
      round_winner_ids: rounds.slice(0, -1),
      current_period: Math.max(1, match.current_period - 1),
      timer_elapsed_seconds: 0,
      timer_running_since: null,
    })
    .eq("id", matchId)
    .eq("status", "in_progress");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
