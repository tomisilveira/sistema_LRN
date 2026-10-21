import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import { applyForfeit, ForfeitError } from "@/lib/forfeit";
import type { ForfeitSide } from "@/lib/database.types";

// "Un equipo no se presentó" desde la pantalla del juez (W.O.) — antes de
// arrancar el partido. Misma credencial que el resto: el token de la
// cancha. Reglas del W.O. en lib/forfeit-rules.ts.
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = (await request.json().catch(() => null)) as { courtToken?: string; side?: ForfeitSide } | null;
  const side = body?.side;
  if (side !== "a" && side !== "b" && side !== "both") {
    return NextResponse.json({ error: "Opción inválida." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let match;
  try {
    match = await assertMatchBelongsToCourt(supabase, matchId, body?.courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  if (match.status !== "scheduled") {
    return NextResponse.json(
      { error: "Solo se puede cargar un W.O. antes de arrancar el partido. Si ya empezó, cerralo con el resultado." },
      { status: 400 }
    );
  }

  try {
    await applyForfeit(supabase, matchId, side, { auto: false });
  } catch (e) {
    if (e instanceof ForfeitError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
