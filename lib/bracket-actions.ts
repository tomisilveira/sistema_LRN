import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketRound } from "./bracket";
import type { BracketType, Match, MatchStatus } from "./database.types";

/**
 * Persiste un cuadro de eliminación directa completo (todas las rondas) en
 * la tabla `matches`, encadenando next_match_id/next_match_slot para que
 * los resultados se propaguen solos, y resolviendo los "byes" de la primera
 * ronda como partidos ya completados (ver advanceWinner).
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

/**
 * Al completarse un partido de cuadro eliminatorio, empuja al ganador a la
 * siguiente ronda (team_a_id o team_b_id del match apuntado por
 * next_match_id/next_match_slot). No hace nada si el partido no pertenece
 * a un cuadro (next_match_id null, ej. la final, o fase de grupos).
 *
 * El partido siguiente nace en status "pending_teams" (ver persistBracket)
 * porque todavía no se sabe quién juega. Acá, además de cargar el equipo que
 * acaba de clasificar, hay que fijarse si con este ya están los DOS equipos
 * — si es así, pasa a "scheduled" para que quede disponible para el juez de
 * cancha (que solo lista partidos scheduled/in_progress, ver
 * app/juez/[courtToken]/page.tsx). Antes se quedaba en pending_teams para
 * siempre y la final nunca aparecía en la cancha aunque ya tuviera los dos
 * clasificados y cancha asignada.
 */
export async function advanceWinner(supabase: SupabaseClient, match: Match): Promise<void> {
  if (!match.next_match_id || !match.winner_id) return;
  const field = match.next_match_slot === "a" ? "team_a_id" : "team_b_id";
  const { data: nextMatch, error } = await supabase
    .from("matches")
    .update({ [field]: match.winner_id })
    .eq("id", match.next_match_id)
    .select("id, status, team_a_id, team_b_id")
    .single();
  if (error) throw error;

  if (nextMatch && nextMatch.status === "pending_teams" && nextMatch.team_a_id && nextMatch.team_b_id) {
    const { error: statusError } = await supabase
      .from("matches")
      .update({ status: "scheduled" })
      .eq("id", nextMatch.id);
    if (statusError) throw statusError;
  }
}
