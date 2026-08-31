import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketRound } from "./bracket";
import type { BracketType, Match, MatchStatus } from "./database.types";

/**
 * Persiste un cuadro de eliminación directa completo (todas las rondas) en
 * la tabla `matches`, encadenando next_match_id/next_match_slot para que
 * los resultados se propaguen solos, y resolviendo los "byes" de la primera
 * ronda como partidos ya completados (ver advanceWinner).
 *
 * Si el cuadro tiene semifinales (una ronda 'SF' con 2 partidos) más final,
 * SIEMPRE agrega el partido por el 3er puesto (round = '3P') y engancha las
 * dos semis con consolation_match_id/slot para que sus PERDEDORES caigan ahí.
 * El 3er puesto se juega ANTES que la final: la final queda 'pending_teams'
 * aunque ya tenga a sus dos finalistas, hasta que el 3er puesto se complete
 * (ver pushTeamInto / advanceWinner).
 */
export async function persistBracket(
  supabase: SupabaseClient,
  competitionId: string,
  bracketType: BracketType | null,
  rounds: BracketRound[]
): Promise<void> {
  const idsByRound: Record<number, Record<number, string>> = {};

  // Se insertan de la última ronda (final) hacia la primera, para poder
  // setear next_match_id de una ronda apuntando a IDs que ya existen.
  for (let r = rounds.length - 1; r >= 0; r--) {
    const round = rounds[r];
    const nextRoundIds = idsByRound[r + 1];
    const isRound1 = r === 0;

    const rowsToInsert = round.matches.map((slot) => {
      const status: MatchStatus = isRound1 ? (slot.isBye ? "completed" : "scheduled") : "pending_teams";
      const winnerId = isRound1 && slot.isBye ? slot.teamAId ?? slot.teamBId ?? null : null;

      let nextMatchId: string | null = null;
      let nextMatchSlot: "a" | "b" | null = null;
      if (nextRoundIds) {
        nextMatchId = nextRoundIds[Math.floor(slot.slot / 2)] ?? null;
        nextMatchSlot = slot.slot % 2 === 0 ? "a" : "b";
      }

      return {
        competition_id: competitionId,
        phase: "bracket" as const,
        bracket_type: bracketType,
        round: round.round,
        bracket_slot: slot.slot,
        team_a_id: isRound1 ? slot.teamAId : null,
        team_b_id: isRound1 ? slot.teamBId : null,
        status,
        winner_id: winnerId,
        next_match_id: nextMatchId,
        next_match_slot: nextMatchSlot,
      };
    });

    const { data, error } = await supabase
      .from("matches")
      .insert(rowsToInsert)
      .select("id, bracket_slot");
    if (error) throw error;

    idsByRound[r] = {};
    for (const row of data ?? []) {
      idsByRound[r][row.bracket_slot as number] = row.id as string;
    }
  }

  // Partido por el 3er puesto: siempre que haya semifinales (ronda 'SF' con
  // 2 partidos) y final. Se engancha ANTES de procesar los byes de abajo
  // para que el re-fetch de la ronda 1 ya traiga consolation_match_id/slot.
  const sfIndex = rounds.findIndex((r) => r.round === "SF");
  const hasFinal = rounds.some((r) => r.round === "F");
  if (sfIndex >= 0 && rounds[sfIndex].matches.length === 2 && hasFinal) {
    const { data: consolation, error: consErr } = await supabase
      .from("matches")
      .insert({
        competition_id: competitionId,
        phase: "bracket" as const,
        bracket_type: bracketType,
        round: "3P",
        bracket_slot: 0,
        team_a_id: null,
        team_b_id: null,
        status: "pending_teams" as const,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null,
      })
      .select("id")
      .single();
    if (consErr) throw consErr;

    const sfIds = idsByRound[sfIndex] ?? {};
    for (const [slot, matchId] of Object.entries(sfIds)) {
      await supabase
        .from("matches")
        .update({
          consolation_match_id: consolation.id,
          consolation_slot: Number(slot) === 0 ? "a" : "b",
        })
        .eq("id", matchId);
    }
  }

  // Los "byes" de la ronda 1 ya quedaron con status completed + winner_id;
  // falta empujar a ese ganador a la ronda 2.
  const round1Ids = Object.values(idsByRound[0] ?? {});
  if (round1Ids.length === 0) return;

  const { data: round1Matches, error: fetchErr } = await supabase
    .from("matches")
    .select("*")
    .in("id", round1Ids);
  if (fetchErr) throw fetchErr;

  for (const match of (round1Matches ?? []) as Match[]) {
    if (match.status === "completed" && match.winner_id) {
      await advanceWinner(supabase, match);
    }
  }
}

type PushTarget = Pick<
  Match,
  "id" | "status" | "team_a_id" | "team_b_id" | "round" | "bracket_type" | "competition_id"
>;

/** ¿La final tiene que esperar a que se juegue el partido por el 3er puesto
 * de su mismo cuadro? (el 3er puesto se juega primero — pedido explícito). */
async function finalMustWaitForThirdPlace(supabase: SupabaseClient, target: PushTarget): Promise<boolean> {
  if (target.round !== "F") return false;
  let q = supabase
    .from("matches")
    .select("status")
    .eq("competition_id", target.competition_id)
    .eq("phase", "bracket")
    .eq("round", "3P");
  q = target.bracket_type ? q.eq("bracket_type", target.bracket_type) : q.is("bracket_type", null);
  const { data } = await q;
  if (!data || data.length === 0) return false;
  return data.some((m) => m.status !== "completed");
}

/** Empuja un equipo a un partido siguiente (ganador → next_match, perdedor →
 * 3er puesto). Si con este quedan definidos los DOS equipos del partido
 * destino y todavía estaba en 'pending_teams', lo pasa a 'scheduled' para
 * que aparezca en la cancha del juez — salvo que sea la final y todavía no
 * se haya jugado el 3er puesto (ese va primero). */
async function pushTeamInto(
  supabase: SupabaseClient,
  targetMatchId: string,
  slot: "a" | "b",
  teamId: string
): Promise<void> {
  const field = slot === "a" ? "team_a_id" : "team_b_id";
  const { data: target, error } = await supabase
    .from("matches")
    .update({ [field]: teamId })
    .eq("id", targetMatchId)
    .select("id, status, team_a_id, team_b_id, round, bracket_type, competition_id")
    .single<PushTarget>();
  if (error) throw error;
  if (!target) return;

  if (target.status === "pending_teams" && target.team_a_id && target.team_b_id) {
    if (await finalMustWaitForThirdPlace(supabase, target)) return; // sigue 'pending_teams'
    const { error: statusError } = await supabase
      .from("matches")
      .update({ status: "scheduled" })
      .eq("id", target.id);
    if (statusError) throw statusError;
  }
}

/** Al completarse el partido por el 3er puesto, habilita la final del mismo
 * cuadro (que estaba 'pending_teams' esperándolo, con sus dos finalistas ya
 * definidos). */
async function unblockFinalAfterThirdPlace(supabase: SupabaseClient, thirdPlaceMatch: Match): Promise<void> {
  let q = supabase
    .from("matches")
    .select("id, status, team_a_id, team_b_id")
    .eq("competition_id", thirdPlaceMatch.competition_id)
    .eq("phase", "bracket")
    .eq("round", "F");
  q = thirdPlaceMatch.bracket_type ? q.eq("bracket_type", thirdPlaceMatch.bracket_type) : q.is("bracket_type", null);
  const { data } = await q;
  for (const f of data ?? []) {
    if (f.status === "pending_teams" && f.team_a_id && f.team_b_id) {
      await supabase.from("matches").update({ status: "scheduled" }).eq("id", f.id);
    }
  }
}

/**
 * Al completarse un partido de cuadro eliminatorio, propaga los equipos que
 * correspondan:
 * - GANADOR → team_a_id/team_b_id del match apuntado por
 *   next_match_id/next_match_slot (la final, la siguiente ronda...).
 * - PERDEDOR → team_a_id/team_b_id del partido por el 3er puesto apuntado
 *   por consolation_match_id/consolation_slot (sólo en las semifinales).
 * - Si el que se completó ES el 3er puesto → habilita la final que estaba
 *   esperándolo.
 *
 * No hace nada si el partido no encadena a ningún lado (ej. la fase de grupos).
 */
export async function advanceWinner(supabase: SupabaseClient, match: Match): Promise<void> {
  if (match.round === "3P" && match.status === "completed") {
    await unblockFinalAfterThirdPlace(supabase, match);
    return;
  }

  if (!match.winner_id) return;

  if (match.next_match_id && match.next_match_slot) {
    await pushTeamInto(supabase, match.next_match_id, match.next_match_slot, match.winner_id);
  }

  if (match.consolation_match_id && match.consolation_slot && match.team_a_id && match.team_b_id) {
    const loserId = match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
    await pushTeamInto(supabase, match.consolation_match_id, match.consolation_slot, loserId);
  }
}
