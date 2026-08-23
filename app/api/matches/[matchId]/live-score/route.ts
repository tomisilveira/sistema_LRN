import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";

// Actualiza el marcador MIENTRAS el partido sigue en curso (modo 'periods',
// fútbol) — a diferencia de /result, no cierra el partido ni calcula
// ganador: es solo para que el público vea el marcador moverse en vivo
// durante el partido. El cierre final sigue pasando por /result (sin
// tocarlo), con el marcador ya cargado acá como punto de partida.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const { courtToken, scoreA, scoreB } = (body ?? {}) as {
    courtToken?: string;
    scoreA?: number;
    scoreB?: number;
  };

  if (typeof scoreA !== "number" || typeof scoreB !== "number" || scoreA < 0 || scoreB < 0) {
    return NextResponse.json({ error: "Marcador inválido." }, { status: 400 });
  }

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
    .update({ score_a: scoreA, score_b: scoreB })
    .eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
