import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceWinner } from "./bracket-actions";
import { maybeAdvanceCompetitionPhase } from "./advance-competition-phase";
import { assertCanRetract, retractBracketPropagation, MatchCorrectionError } from "./match-correction";
import { forfeitResult } from "./forfeit-rules";
import type { Competition, ForfeitSide, GroupStandingRow, Match, Team } from "./database.types";

// Robots rotos (oct 2026): W.O. por partido y baja de equipos. Reglas en
// lib/forfeit-rules.ts; acá se aplican sobre la base.
//
// · applyForfeit: "no se presentó A / B / ninguno" en un partido.
// · settleBracketMatch: resuelve un partido de la llave al que le falta
//   gente — si un equipo está dado de baja → W.O.; si un lado quedó vacío
//   (su cruce anterior fue doble W.O.) → pase directo; si quedaron vacíos
//   los dos → el partido se cierra vacío y sigue hacia adelante.
// · withdrawTeam: baja (robot roto). Partidos pendientes por W.O.; en la
//   llave, si su partido de primera ronda no empezó, entra el siguiente de
//   su grupo en su lugar.
// · reinstateTeam: deshace la baja y los W.O. automáticos que se puedan.

export class ForfeitError extends Error {}

type CompetitionLite = Pick<Competition, "id" | "format_type" | "timer_mode" | "rounds_to_win" | "status">;

async function loadCompetition(supabase: SupabaseClient, competitionId: string): Promise<CompetitionLite> {
  const { data } = await supabase
    .from("competitions")
    .select("id, format_type, timer_mode, rounds_to_win, status")
    .eq("id", competitionId)
    .single<CompetitionLite>();
  if (!data) throw new ForfeitError("Torneo no encontrado.");
  return data;
}

async function isWithdrawn(supabase: SupabaseClient, teamId: string | null): Promise<boolean> {
  if (!teamId) return false;
  const { data } = await supabase.from("teams").select("withdrawn_at").eq("id", teamId).maybeSingle();
  return !!data?.withdrawn_at;
}

/** Cierra un partido por W.O. y propaga (llave) / recalcula fase. No
 * valida permisos: lo llaman el admin (sesión con RLS) y el juez (token
 * validado antes). */
export async function applyForfeit(
  supabase: SupabaseClient,
  matchId: string,
  side: ForfeitSide,
  opts: { auto: boolean; skipPhaseCheck?: boolean } = { auto: false }
): Promise<Match> {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single<Match>();
  if (!match) throw new ForfeitError("Partido no encontrado.");
  if (match.status === "completed") {
    throw new ForfeitError("Este partido ya tiene resultado. Reinicialo primero si hay que cambiarlo.");
  }
  if (!match.team_a_id || !match.team_b_id) {
    throw new ForfeitError("Todavía no están definidos los dos equipos de este partido.");
  }
  const competition = await loadCompetition(supabase, match.competition_id);
  const knockout = match.phase === "bracket";
  const result = forfeitResult(competition, side, match.team_a_id, match.team_b_id, knockout);

  const { data: updated, error } = await supabase
    .from("matches")
    .update({
      ...result,
      status: "completed",
      forfeit: side,
      forfeit_auto: opts.auto,
      timer_running_since: null,
    })
    .eq("id", matchId)
    .neq("status", "completed")
    .select("*")
    .single<Match>();
  if (error) throw new Error(error.message);

  if (knockout) {
    if (updated.winner_id) await advanceWinner(supabase, updated);
    else await propagateEmpty(supabase, updated);
  }
  if (!opts.skipPhaseCheck) await maybeAdvanceCompetitionPhase(supabase, match.competition_id);
  return updated;
}

/** Un partido de llave cerrado sin ganador (doble W.O. o vacío): no manda a
 * nadie adelante — el partido siguiente y el 3er puesto se resuelven con
 * lo que tengan. */
async function propagateEmpty(supabase: SupabaseClient, match: Match): Promise<void> {
  if (match.next_match_id) await settleBracketMatch(supabase, match.next_match_id);
  if (match.consolation_match_id) await settleBracketMatch(supabase, match.consolation_match_id);
  if (match.round === "3P") {
    // El 3er puesto vacío habilita igual la final (que lo espera).
    await advanceWinner(supabase, match);
  }
}

type Feeder = Pick<Match, "id" | "status" | "team_a_id" | "team_b_id" | "winner_id" | "next_match_slot" | "consolation_slot">;

/** ¿El cruce anterior que alimenta este lugar ya terminó sin mandar a
 * nadie? (cruce de ganador: cerrado sin ganador; cruce de perdedor — 3er
 * puesto —: cerrado sin perdedor, ej. pase directo o doble W.O.). */
function feederProducesNobody(f: Feeder, kind: "winner" | "loser"): boolean {
  if (f.status !== "completed") return false;
  if (kind === "winner") return !f.winner_id;
  return !f.winner_id || !f.team_a_id || !f.team_b_id;
}

/**
 * Resuelve un partido de la llave al que le puede faltar gente. Idempotente
 * y seguro de llamar en cualquier momento (lo llama pushTeamInto cada vez
 * que entra un equipo):
 * - con los dos equipos y alguno dado de baja → W.O. automático;
 * - un equipo y el otro lugar vacío para siempre → pase directo;
 * - los dos lugares vacíos para siempre → se cierra vacío.
 */
export async function settleBracketMatch(supabase: SupabaseClient, matchId: string): Promise<void> {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle<Match>();
  if (!match || match.phase !== "bracket" || match.status === "completed") return;

  if (match.team_a_id && match.team_b_id) {
    const [aOut, bOut] = await Promise.all([isWithdrawn(supabase, match.team_a_id), isWithdrawn(supabase, match.team_b_id)]);
    if ((aOut || bOut) && match.status !== "in_progress") {
      await applyForfeit(supabase, match.id, aOut && bOut ? "both" : aOut ? "a" : "b", {
        auto: true,
        skipPhaseCheck: true,
      });
    }
    return;
  }

  // Falta al menos un equipo: ¿ese lugar va a llegar o quedó vacío?
  const [{ data: winnerFeeders }, { data: loserFeeders }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, status, team_a_id, team_b_id, winner_id, next_match_slot, consolation_slot")
      .eq("next_match_id", match.id),
    supabase
      .from("matches")
      .select("id, status, team_a_id, team_b_id, winner_id, next_match_slot, consolation_slot")
      .eq("consolation_match_id", match.id),
  ]);
  const feeders = [
    ...((winnerFeeders ?? []) as Feeder[]).map((f) => ({ f, slot: f.next_match_slot, kind: "winner" as const })),
    ...((loserFeeders ?? []) as Feeder[]).map((f) => ({ f, slot: f.consolation_slot, kind: "loser" as const })),
  ];
  // Partido de primera ronda (sin cruces anteriores): un lugar vacío ya es
  // definitivo (pase directo). Si no, depende de su cruce.
  const slotEmpty = (slot: "a" | "b") => {
    const team = slot === "a" ? match.team_a_id : match.team_b_id;
    if (team) return false;
    const feeder = feeders.find((x) => x.slot === slot);
    if (!feeder) return feeders.length === 0;
    return feederProducesNobody(feeder.f, feeder.kind);
  };

  const aEmpty = slotEmpty("a");
  const bEmpty = slotEmpty("b");
  const onlyTeam = match.team_a_id ?? match.team_b_id;

  if (onlyTeam && (match.team_a_id ? bEmpty : aEmpty)) {
    if (await isWithdrawn(supabase, onlyTeam)) {
      await closeEmpty(supabase, match);
      return;
    }
    // Pase directo (sin marcador), igual que un "bye" de la primera ronda.
    const { data: updated } = await supabase
      .from("matches")
      .update({ status: "completed", winner_id: onlyTeam, score_a: null, score_b: null })
      .eq("id", match.id)
      .neq("status", "completed")
      .select("*")
      .single<Match>();
    if (updated) await advanceWinner(supabase, updated);
    return;
  }

  if (!onlyTeam && aEmpty && bEmpty) await closeEmpty(supabase, match);
}

async function closeEmpty(supabase: SupabaseClient, match: Match): Promise<void> {
  const { data: updated } = await supabase
    .from("matches")
    .update({ status: "completed", winner_id: null, score_a: null, score_b: null, forfeit: "both", forfeit_auto: true })
    .eq("id", match.id)
    .neq("status", "completed")
    .select("*")
    .single<Match>();
  if (updated) await propagateEmpty(supabase, updated);
}

// ---------------------------------------------------------------------------
// Baja de un equipo
// ---------------------------------------------------------------------------

export interface WithdrawSummary {
  forfeits: number;
  replacedBy: string[];
}

/** Partido de primera ronda de su cuadro (nadie lo alimenta: ni un ganador
 * ni — en el 3er puesto — un perdedor de semifinal). */
async function isFirstRound(supabase: SupabaseClient, matchId: string): Promise<boolean> {
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`next_match_id.eq.${matchId},consolation_match_id.eq.${matchId}`);
  return (count ?? 0) === 0;
}

/**
 * Busca quién entra a la llave en lugar de `teamOutId` (el siguiente de su
 * grupo, por orden de tabla) y lo pone en ese lugar. Si el candidato estaba
 * en primera ronda de OTRO cuadro (plata, en oro/plata) sin empezar, sube y
 * su lugar en ese cuadro se vuelve a cubrir igual. Devuelve el nombre del
 * que entró, o null si no hay nadie para entrar.
 */
async function replaceInBracket(
  supabase: SupabaseClient,
  match: Match,
  slot: "a" | "b",
  teamOutId: string,
  depth = 0
): Promise<string | null> {
  if (depth > 3) return null;
  const { data: gt } = await supabase.from("group_teams").select("group_id").eq("team_id", teamOutId).maybeSingle();
  if (!gt) return null;

  const [{ data: standings }, { data: bracketMatches }] = await Promise.all([
    supabase.rpc("get_group_standings", { p_group_id: gt.group_id }),
    supabase
      .from("matches")
      .select("id, bracket_type, status, team_a_id, team_b_id")
      .eq("competition_id", match.competition_id)
      .eq("phase", "bracket"),
  ]);
  const sameBracket = (bracketMatches ?? []).filter((m) => m.bracket_type === match.bracket_type);
  const inSameBracket = new Set(sameBracket.flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean));

  for (const row of (standings ?? []) as GroupStandingRow[]) {
    if (row.team_id === teamOutId || row.withdrawn || inSameBracket.has(row.team_id)) continue;

    // ¿Está en otro cuadro (plata)? Solo si ese partido no empezó y es de
    // primera ronda: sube y se cubre su lugar allá.
    const elsewhere = (bracketMatches ?? []).find(
      (m) => m.bracket_type !== match.bracket_type && (m.team_a_id === row.team_id || m.team_b_id === row.team_id)
    );
    if (elsewhere) {
      if (elsewhere.status === "completed" || elsewhere.status === "in_progress") continue;
      if (!(await isFirstRound(supabase, elsewhere.id))) continue;
    }

    const field = slot === "a" ? "team_a_id" : "team_b_id";
    const { error } = await supabase.from("matches").update({ [field]: row.team_id }).eq("id", match.id);
    if (error) throw new Error(error.message);

    if (elsewhere) {
      const { data: other } = await supabase.from("matches").select("*").eq("id", elsewhere.id).single<Match>();
      if (other) {
        const otherSlot = other.team_a_id === row.team_id ? "a" : "b";
        const replaced = await replaceInBracket(supabase, other, otherSlot, row.team_id, depth + 1);
        if (!replaced) {
          await supabase
            .from("matches")
            .update({ [otherSlot === "a" ? "team_a_id" : "team_b_id"]: null })
            .eq("id", other.id);
          await settleBracketMatch(supabase, other.id);
        }
      }
    }
    return row.team_name;
  }
  return null;
}

export async function withdrawTeam(
  supabase: SupabaseClient,
  competitionId: string,
  teamId: string,
  reason: string | null
): Promise<WithdrawSummary> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, competition_id, withdrawn_at")
    .eq("id", teamId)
    .maybeSingle<Pick<Team, "id" | "competition_id" | "withdrawn_at">>();
  if (!team || team.competition_id !== competitionId) throw new ForfeitError("Equipo no encontrado.");
  if (team.withdrawn_at) throw new ForfeitError("Este equipo ya está dado de baja.");

  const competition = await loadCompetition(supabase, competitionId);
  const { error } = await supabase
    .from("teams")
    .update({ withdrawn_at: new Date().toISOString(), withdrawn_reason: reason })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  const summary: WithdrawSummary = { forfeits: 0, replacedBy: [] };
  const hasGroups = competition.format_type !== "bracket_only" && competition.format_type !== "time_trial";

  // Varias vueltas: un W.O. en la llave puede mandar al equipo a otro
  // partido (ej. perdió la semi por W.O. → cae al 3er puesto).
  for (let pass = 0; pass < 10; pass++) {
    const { data: pending } = await supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competitionId)
      .neq("status", "completed")
      .neq("status", "in_progress")
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
    const list = (pending ?? []) as Match[];
    let changed = false;

    for (const m of list) {
      const slot: "a" | "b" = m.team_a_id === teamId ? "a" : "b";
      const rivalId = slot === "a" ? m.team_b_id : m.team_a_id;

      if (m.phase === "bracket" && hasGroups && (await isFirstRound(supabase, m.id))) {
        const replaced = await replaceInBracket(supabase, m, slot, teamId);
        if (replaced) {
          summary.replacedBy.push(replaced);
          // Si el que entró se enfrenta a otro dado de baja, se resuelve ya.
          await settleBracketMatch(supabase, m.id);
          changed = true;
          continue;
        }
      }

      if (!rivalId) continue; // el rival todavía no está: se resuelve cuando llegue (pushTeamInto)
      const rivalOut = await isWithdrawn(supabase, rivalId);
      await applyForfeit(supabase, m.id, rivalOut ? "both" : slot, { auto: true, skipPhaseCheck: true });
      summary.forfeits++;
      changed = true;
    }
    if (!changed) break;
  }

  await maybeAdvanceCompetitionPhase(supabase, competitionId);
  return summary;
}

// ---------------------------------------------------------------------------
// Reincorporar
// ---------------------------------------------------------------------------

export interface ReinstateSummary {
  reopened: number;
  notUndone: number;
}

export async function reinstateTeam(
  supabase: SupabaseClient,
  competitionId: string,
  teamId: string
): Promise<ReinstateSummary> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, competition_id, withdrawn_at")
    .eq("id", teamId)
    .maybeSingle<Pick<Team, "id" | "competition_id" | "withdrawn_at">>();
  if (!team || team.competition_id !== competitionId) throw new ForfeitError("Equipo no encontrado.");
  if (!team.withdrawn_at) throw new ForfeitError("Este equipo no está dado de baja.");

  const { error } = await supabase.from("teams").update({ withdrawn_at: null, withdrawn_reason: null }).eq("id", teamId);
  if (error) throw new Error(error.message);

  const { data: autoMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("forfeit_auto", true)
    .eq("status", "completed")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  const summary: ReinstateSummary = { reopened: 0, notUndone: 0 };
  const competition = await loadCompetition(supabase, competitionId);

  for (const m of (autoMatches ?? []) as Match[]) {
    const slot: "a" | "b" = m.team_a_id === teamId ? "a" : "b";
    const rivalId = slot === "a" ? m.team_b_id : m.team_a_id;
    // Solo los W.O. donde ESTE equipo era el ausente.
    if (m.forfeit !== slot && m.forfeit !== "both") continue;

    if (m.phase === "group") {
      if (m.forfeit === "both" && rivalId && (await isWithdrawn(supabase, rivalId))) {
        // El rival sigue de baja: ahora el W.O. es a favor de este equipo.
        const result = forfeitResult(competition, slot === "a" ? "b" : "a", m.team_a_id!, m.team_b_id!, false);
        await supabase
          .from("matches")
          .update({ ...result, forfeit: slot === "a" ? "b" : "a", forfeit_auto: true })
          .eq("id", m.id);
      } else {
        await reopenMatch(supabase, m);
      }
      summary.reopened++;
      continue;
    }

    // Llave: solo si nadie avanzó todavía gracias a ese W.O.
    try {
      await assertCanRetract(supabase, m);
      await retractBracketPropagation(supabase, m);
      await reopenMatch(supabase, m);
      summary.reopened++;
    } catch (e) {
      if (e instanceof MatchCorrectionError) summary.notUndone++;
      else throw e;
    }
  }

  if (competition.status === "finished" && summary.reopened > 0) {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId)
      .eq("phase", "bracket");
    await supabase
      .from("competitions")
      .update({ status: (count ?? 0) > 0 ? "bracket_in_progress" : "groups_in_progress" })
      .eq("id", competitionId);
  }
  return summary;
}

async function reopenMatch(supabase: SupabaseClient, m: Match): Promise<void> {
  await supabase
    .from("matches")
    .update({
      status: m.team_a_id && m.team_b_id ? "scheduled" : "pending_teams",
      score_a: null,
      score_b: null,
      winner_id: null,
      forfeit: null,
      forfeit_auto: false,
      started_at: null,
      timer_running_since: null,
      timer_elapsed_seconds: 0,
      current_period: 1,
      round_winner_ids: [],
    })
    .eq("id", m.id);
}
