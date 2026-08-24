import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMatchBelongsToCourt, JudgeAuthError } from "@/lib/judge-auth";
import type { CardType } from "@/lib/database.types";

const CARD_TYPES: CardType[] = ["yellow", "red"];

/** Carga una tarjeta (amarilla/roja) a un equipo del partido en curso —
 * mismo mecanismo sin sesión que result/round-result: el juez no tiene
 * login, se valida el access_token de la cancha y se escribe con la
 * service-role key. "Doble amarilla = roja" NO se resuelve acá: se guarda
 * la tarjeta tal cual la cargó el juez (2 filas 'yellow' si corresponde) y
 * quien la muestra decide tratarla como roja (ver lib/match-cards.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const { courtToken, teamId, cardType, reason } = (body ?? {}) as {
    courtToken?: string;
    teamId?: string;
    cardType?: string;
    reason?: string;
  };

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
  if (teamId !== match.team_a_id && teamId !== match.team_b_id) {
    return NextResponse.json({ error: "El equipo no pertenece a este partido." }, { status: 400 });
  }
  if (!cardType || !CARD_TYPES.includes(cardType as CardType)) {
    return NextResponse.json({ error: "Tipo de tarjeta inválido." }, { status: 400 });
  }

  const { error } = await supabase.from("match_cards").insert({
    match_id: matchId,
    team_id: teamId,
    card_type: cardType,
    reason: reason?.trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Borra una tarjeta cargada por error — no exige partido en curso (puede
 * necesitarse corregir después de cerrado). */
export async function DELETE(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const body = await request.json().catch(() => null);
  const { courtToken, cardId } = (body ?? {}) as { courtToken?: string; cardId?: string };

  const supabase = createAdminClient();

  try {
    await assertMatchBelongsToCourt(supabase, matchId, courtToken);
  } catch (e) {
    if (e instanceof JudgeAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (!cardId) return NextResponse.json({ error: "Falta la tarjeta a borrar." }, { status: 400 });

  const { error } = await supabase.from("match_cards").delete().eq("id", cardId).eq("match_id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
