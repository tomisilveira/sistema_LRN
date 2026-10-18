import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "./database.types";

// Corrección y reinicio de partidos desde el panel admin (oct 2026, pedido
// después de un resultado mal cargado en sumo que hubo que arreglar a mano
// en la base). En la fase de grupos alcanza con pisar el partido — la tabla
// se recalcula sola (get_group_standings). En el cuadro, el ganador (y en
// las semis, el perdedor) ya viajó al partido siguiente: antes de cambiar
// el resultado hay que sacarlo de ahí, y eso solo se puede si ese partido
// todavía no se empezó a jugar.

export class MatchCorrectionError extends Error {}

type TargetRow = Pick<
  Match,
  "id" | "status" | "team_a_id" | "team_b_id" | "round" | "bracket_type" | "competition_id" | "score_a" | "score_b"
>;

/** Saca a `teamId` del partido destino (siguiente ronda o 3er puesto).
 * Tira MatchCorrectionError si ese partido ya se está jugando o se jugó. */
async function removeTeamFrom(
  supabase: SupabaseClient,
  targetId: string,
  slot: "a" | "b",
  teamId: string
): Promise<void> {
  const { data: target } = await supabase
    .from("matches")
    .select("id, status, team_a_id, team_b_id, round, bracket_type, competition_id, score_a, score_b")
    .eq("id", targetId)
    .maybeSingle<TargetRow>();
  if (!target) return;

  const field = slot === "a" ? "team_a_id" : "team_b_id";
  if (target[field] !== teamId) return; // ya no está ahí: nada que deshacer

  // 3er puesto que se dio por resuelto solo (un único equipo, sin marcador —
  // ver resolveThirdPlaceWithoutRival): no se jugó de verdad, se puede abrir.
  const autoResolvedThird =
    target.round === "3P" &&
    target.status === "completed" &&
    (!target.team_a_id || !target.team_b_id) &&
    target.score_a === null &&
    target.score_b === null;

  if ((target.status === "in_progress" || target.status === "completed") && !autoResolvedThird) {
    throw new MatchCorrectionError(
      target.round === "3P"
        ? "El partido por el 3er puesto ya se empezó a jugar. Reinicialo primero y después corregí este."
        : "El partido siguiente del cuadro ya se empezó a jugar. Reinicialo primero y después corregí este."
    );
  }

  const { error } = await supabase
    .from("matches")
    .update({
      [field]: null,
      status: "pending_teams",
      winner_id: null,
      score_a: null,
      score_b: null,
    })
    .eq("id", target.id);
  if (error) throw new Error(error.message);

  if (target.round === "3P") await rewaitFinal(supabase, target);
}

/** La final espera al 3er puesto: si el 3er puesto vuelve a quedar sin
 * jugar y la final todavía no arrancó, vuelve a 'pending_teams'. */
async function rewaitFinal(
  supabase: SupabaseClient,
  thirdPlace: Pick<Match, "competition_id" | "bracket_type">
): Promise<void> {
  let q = supabase
    .from("matches")
    .select("id, status")
    .eq("competition_id", thirdPlace.competition_id)
    .eq("phase", "bracket")
    .eq("round", "F");
  q = thirdPlace.bracket_type ? q.eq("bracket_type", thirdPlace.bracket_type) : q.is("bracket_type", null);
  const { data } = await q;
  for (const f of data ?? []) {
    if (f.status === "scheduled") {
      await supabase.from("matches").update({ status: "pending_teams" }).eq("id", f.id);
    }
  }
}

/** Deshace lo que un partido de cuadro ya completado propagó: saca al
 * ganador del partido siguiente y al perdedor del 3er puesto. Si el partido
 * ES el 3er puesto, la final vuelve a esperarlo. No hace nada en grupos. */
export async function retractBracketPropagation(supabase: SupabaseClient, match: Match): Promise<void> {
  if (match.phase !== "bracket" || match.status !== "completed") return;

  if (match.round === "3P") {
    await rewaitFinal(supabase, match);
    return;
  }
  if (!match.winner_id) return;

  if (match.next_match_id && match.next_match_slot) {
    await removeTeamFrom(supabase, match.next_match_id, match.next_match_slot, match.winner_id);
  }
  if (match.consolation_match_id && match.consolation_slot && match.team_a_id && match.team_b_id) {
    const loserId = match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
    await removeTeamFrom(supabase, match.consolation_match_id, match.consolation_slot, loserId);
  }
}

/** Revisa ANTES de tocar nada que la corrección se pueda hacer, para no
 * dejar el cuadro a medio deshacer si el partido siguiente ya se jugó. */
export async function assertCanRetract(supabase: SupabaseClient, match: Match): Promise<void> {
  if (match.phase !== "bracket" || match.status !== "completed" || match.round === "3P" || !match.winner_id) return;
  const targets: { id: string; teamId: string; field: "team_a_id" | "team_b_id" }[] = [];
  if (match.next_match_id && match.next_match_slot) {
    targets.push({
      id: match.next_match_id,
      teamId: match.winner_id,
      field: match.next_match_slot === "a" ? "team_a_id" : "team_b_id",
    });
  }
  if (match.consolation_match_id && match.consolation_slot && match.team_a_id && match.team_b_id) {
    targets.push({
      id: match.consolation_match_id,
      teamId: match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id,
      field: match.consolation_slot === "a" ? "team_a_id" : "team_b_id",
    });
  }
  for (const t of targets) {
    const { data } = await supabase
      .from("matches")
      .select("status, round, team_a_id, team_b_id, score_a, score_b")
      .eq("id", t.id)
      .maybeSingle<Pick<Match, "status" | "round" | "team_a_id" | "team_b_id" | "score_a" | "score_b">>();
    if (!data || data[t.field] !== t.teamId) continue;
    const autoResolvedThird =
      data.round === "3P" && (!data.team_a_id || !data.team_b_id) && data.score_a === null && data.score_b === null;
    if ((data.status === "in_progress" || data.status === "completed") && !autoResolvedThird) {
      throw new MatchCorrectionError(
        data.round === "3P"
          ? "El partido por el 3er puesto ya se empezó a jugar. Reinicialo primero y después cambiá este."
          : "El partido siguiente del cuadro ya se empezó a jugar. Reinicialo primero y después cambiá este."
      );
    }
  }
}

/** Rounds "de mentira" para un marcador cargado a mano en sumo (el reloj
 * del juez dibuja un puntito por round): los del perdedor primero, el último
 * round para el ganador. */
export function syntheticRoundWinners(
  teamAId: string,
  teamBId: string,
  scoreA: number | null,
  scoreB: number | null,
  winnerId: string | null
): string[] {
  if (scoreA === null || scoreB === null) return winnerId ? [winnerId] : [];
  const a = Array<string>(Math.max(0, scoreA)).fill(teamAId);
  const b = Array<string>(Math.max(0, scoreB)).fill(teamBId);
  return winnerId === teamAId ? [...b, ...a] : [...a, ...b];
}
