// Helpers compartidos por scripts/sim-1-setup.ts y scripts/sim-2-finish.ts —
// simulación end-to-end de un evento con las 5 disciplinas y los 4
// format_type existentes, jugada por script (sin pasar por el panel admin)
// pero reusando la MISMA lógica pura que usa la app real
// (round-robin.ts, bracket.ts, auto-schedule.ts, match-logic.ts).
//
// lib/apply-auto-schedule.ts, lib/generate-bracket-for-competition.ts y
// lib/bracket-actions.ts tienen `import "server-only"` — no se pueden
// importar fuera del build de Next, así que acá se repite su parte de
// persistencia en Supabase (mismo patrón que ya usaba scripts/seed-full-demo.ts).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateRoundRobinPairs } from "../lib/round-robin";
import { autoScheduleMatches, type SchedulableMatch } from "../lib/auto-schedule";
import { buildSeedOrder, generateBracketRounds, type BracketRound } from "../lib/bracket";
import { computeMatchOutcome } from "../lib/match-logic";
import type { BracketType, FormatType } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
export const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const STATE_FILE = join(process.cwd(), ".sim-state.json");

export function saveState(state: Record<string, unknown>) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
export function loadState(): Record<string, any> {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

// ==========================================================================
// Auto-scheduling (mismo algoritmo que lib/apply-auto-schedule.ts)
// ==========================================================================
export async function autoScheduleAndPersist(
  eventId: string,
  disciplineId: string,
  matches: SchedulableMatch[]
): Promise<void> {
  if (matches.length === 0) return;
  const { data: courts } = await supabase
    .from("courts")
    .select("id, discipline_id, sort_order")
    .eq("event_id", eventId)
    .order("sort_order");
  const list = courts ?? [];
  const matching = list.filter((c) => c.discipline_id === disciplineId);
  const usable = (matching.length > 0 ? matching : list).map((c) => ({ id: c.id }));
  const assignments = autoScheduleMatches(matches, usable);
  for (const a of assignments) {
    await supabase.from("matches").update({ court_id: a.courtId, turno: a.turno }).eq("id", a.matchId);
  }
}

// ==========================================================================
// Cuadro eliminatorio (mismo algoritmo que lib/bracket-actions.ts)
// ==========================================================================
export async function persistBracket(
  competitionId: string,
  bracketType: BracketType | null,
  rounds: BracketRound[]
): Promise<void> {
  const idsByRound: Record<number, Record<number, string>> = {};
  for (let r = rounds.length - 1; r >= 0; r--) {
    const round = rounds[r];
    const nextRoundIds = idsByRound[r + 1];
    const isRound1 = r === 0;
    const rows = round.matches.map((slot) => {
      const status = isRound1 ? (slot.isBye ? "completed" : "scheduled") : "pending_teams";
      const winnerId = isRound1 && slot.isBye ? (slot.teamAId ?? slot.teamBId ?? null) : null;
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
    const { data } = await supabase.from("matches").insert(rows).select("id, bracket_slot");
    idsByRound[r] = {};
    for (const row of data ?? []) idsByRound[r][row.bracket_slot as number] = row.id as string;
  }
  const round1Ids = Object.values(idsByRound[0] ?? {});
  if (round1Ids.length === 0) return;
  const { data: round1Matches } = await supabase.from("matches").select("*").in("id", round1Ids);
  for (const m of round1Matches ?? []) {
    if (m.status === "completed" && m.winner_id && m.next_match_id) {
      await advanceWinner(m as any);
    }
  }
}

export async function advanceWinner(match: {
  next_match_id: string | null;
  next_match_slot: "a" | "b" | null;
  winner_id: string | null;
}): Promise<void> {
  if (!match.next_match_id || !match.winner_id) return;
  const field = match.next_match_slot === "a" ? "team_a_id" : "team_b_id";
  const { data: nextMatch } = await supabase
    .from("matches")
    .update({ [field]: match.winner_id })
    .eq("id", match.next_match_id)
    .select("id, status, team_a_id, team_b_id")
    .single();
  if (nextMatch && nextMatch.status === "pending_teams" && nextMatch.team_a_id && nextMatch.team_b_id) {
    await supabase.from("matches").update({ status: "scheduled" }).eq("id", nextMatch.id);
  }
}

async function bracketExists(competitionId: string, bracketType: BracketType | null): Promise<boolean> {
  const base = supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("phase", "bracket");
  const { count } = bracketType ? await base.eq("bracket_type", bracketType) : await base.is("bracket_type", null);
  return (count ?? 0) > 0;
}

async function collectGroupSeeds(competitionId: string, select: (rows: any[]) => any[]) {
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", competitionId)
    .order("sort_order");
  const qualifiersByGroup = [];
  for (const g of groups ?? []) {
    const { data: standings } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
    const rows = select(standings ?? []);
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.map((r, i) => ({ teamId: r.team_id, teamName: r.team_name, rank: i + 1 })),
    });
  }
  return qualifiersByGroup;
}

async function generateGroupBracket(
  competitionId: string,
  bracketType: BracketType | null,
  select: (rows: any[]) => any[]
): Promise<void> {
  if (await bracketExists(competitionId, bracketType)) return;
  const qualifiersByGroup = await collectGroupSeeds(competitionId, select);
  const seedTeams = buildSeedOrder(qualifiersByGroup);
  if (seedTeams.length < 2) return;
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(competitionId, bracketType, rounds);
}

async function generateBracketOnlyBracket(competitionId: string): Promise<void> {
  if (await bracketExists(competitionId, null)) return;
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("competition_id", competitionId)
    .order("seed_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const teamList = teams ?? [];
  if (teamList.length < 2) throw new Error("Cargá al menos 2 equipos antes de generar el cuadro.");
  const seedTeams = teamList.map((t: any, i: number) => ({ teamId: t.id, teamName: t.name, seed: i + 1 }));
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(competitionId, null, rounds);
}

/** Igual que lib/generate-bracket-for-competition.ts (generateBracketForCompetition). */
export async function generateBracketForCompetition(competitionId: string): Promise<void> {
  const { data: competition } = await supabase.from("competitions").select("*").eq("id", competitionId).single();
  if (!competition) throw new Error("Competencia no encontrada.");

  if (competition.format_type === "bracket_only") {
    await generateBracketOnlyBracket(competitionId);
  } else if (competition.format_type === "gold_silver") {
    await generateGroupBracket(competitionId, "gold", (s) => s.slice(0, competition.qualifiers_per_group));
    await generateGroupBracket(competitionId, "silver", (s) => s.slice(competition.qualifiers_per_group));
  } else if (competition.format_type === "single_elimination" || competition.format_type === "groups_only") {
    await generateGroupBracket(competitionId, null, (s) => s.slice(0, competition.qualifiers_per_group));
  } else {
    throw new Error("Esta competencia no tiene un formato con cuadro de eliminación.");
  }

  const { data: bracketMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("competition_id", competitionId)
    .eq("phase", "bracket")
    .neq("status", "completed");
  if ((bracketMatches ?? []).length > 0) {
    await autoScheduleAndPersist(
      competition.event_id,
      competition.discipline_id,
      (bracketMatches ?? []) as SchedulableMatch[]
    );
  }

  const { count: totalBracketMatches } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("phase", "bracket");
  if ((totalBracketMatches ?? 0) > 0) {
    await supabase
      .from("competitions")
      .update({ status: "bracket_in_progress", registration_open: false })
      .eq("id", competitionId);
  }
}

/** Igual que lib/advance-competition-phase.ts (maybeAdvanceCompetitionPhase). */
export async function maybeAdvanceCompetitionPhase(competitionId: string): Promise<void> {
  const { data: competition } = await supabase.from("competitions").select("*").eq("id", competitionId).single();
  if (!competition) return;

  if (competition.status === "groups_in_progress") {
    const { data: groupMatches } = await supabase
      .from("matches")
      .select("status")
      .eq("competition_id", competitionId)
      .eq("phase", "group");
    const allDone = !!groupMatches && groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");
    if (allDone) {
      if (competition.format_type === "single_elimination" || competition.format_type === "gold_silver") {
        await generateBracketForCompetition(competitionId);
      } else {
        await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
      }
    }
  }

  if (competition.status === "bracket_in_progress") {
    const types: (BracketType | null)[] = competition.format_type === "gold_silver" ? ["gold", "silver"] : [null];
    const finalsDone = await Promise.all(
      types.map(async (bracketType) => {
        const base = supabase
          .from("matches")
          .select("status")
          .eq("competition_id", competitionId)
          .eq("phase", "bracket")
          .eq("round", "F");
        const { data: finalMatches } = bracketType ? await base.eq("bracket_type", bracketType) : await base.is("bracket_type", null);
        if (!finalMatches || finalMatches.length === 0) return true;
        return finalMatches.every((m) => m.status === "completed");
      })
    );
    if (finalsDone.every(Boolean)) {
      await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
    }
  }
}

// ==========================================================================
// Completar partidos con resultado
// ==========================================================================
export async function completeMatch(
  match: { id: string; team_a_id: string | null; team_b_id: string | null },
  opts: { allowDraws: boolean; hasScore: boolean; rngSeed: number }
) {
  if (!match.team_a_id || !match.team_b_id) return;
  if (opts.hasScore) {
    const scoreA = opts.rngSeed % 5;
    const scoreB = (opts.rngSeed * 7 + 2) % 5;
    const outcome = computeMatchOutcome({
      allowDraws: opts.allowDraws,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreA,
      scoreB,
    });
    await supabase
      .from("matches")
      .update({ score_a: scoreA, score_b: scoreB, winner_id: outcome.winner_id, status: "completed" })
      .eq("id", match.id);
  } else {
    const winnerId = opts.rngSeed % 2 === 0 ? match.team_a_id : match.team_b_id;
    const outcome = computeMatchOutcome({
      allowDraws: false,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreA: null,
      scoreB: null,
      winnerIdIfNoScore: winnerId,
    });
    await supabase.from("matches").update({ winner_id: outcome.winner_id, status: "completed" }).eq("id", match.id);
  }
}

/** Juega TODOS los partidos de cuadro pendientes de una competencia (uno o
 * los dos bracket_type en gold_silver) hasta que las finales queden
 * completed, empujando ganadores de ronda en ronda como haría el juez real. */
export async function playBracketToCompletion(competitionId: string, hasScore: boolean, allowDraws: boolean) {
  let guard = 0;
  while (guard++ < 50) {
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competitionId)
      .eq("phase", "bracket")
      .neq("status", "completed");
    const ready = (matches ?? []).filter((m) => m.team_a_id && m.team_b_id);
    if (ready.length === 0) break;
    for (const [i, m] of ready.entries()) {
      await completeMatch(m as any, { allowDraws, hasScore, rngSeed: i + guard });
      const { data: updated } = await supabase.from("matches").select("*").eq("id", m.id).single();
      if (updated?.winner_id && updated?.next_match_id) {
        await advanceWinner(updated as any);
      }
    }
  }
}

// ==========================================================================
// Equipos ficticios
// ==========================================================================
const TEAM_ADJ = [
  "Los Tornillos", "Circuito Azul", "Robotines FC", "Chispa Robótica", "Engranaje Rojo", "Pixel Bots",
  "Neuquén Robots", "Los Halcones de Acero", "Team Voltaje", "Escuadrón Binario", "Turbo Sur", "Los Autómatas",
  "Sumo Rex", "Aplastador Jr", "Mini Titán", "Dohyo Kids", "Fuerza Bruta", "Relámpago Gris",
  "Bytes del Sur", "Servo Fénix", "Alma de Hierro", "Torque Total", "Vector Verde", "Kraken Robótico",
  "Los Patagones", "Circuito Cero", "Doble Hélice", "Nitro Bots", "Overclock FC", "Segmento 7",
  "Andes Robotics", "Confluencia FC", "Placa Madre", "Estación Sur", "Rueda Libre", "Motor Naranja",
  "Los Rescatistas", "Chip y Cía", "Sensor Fino", "Punta de Prueba", "Circuito Cerrado", "Bandera Cuadriculada",
  "Codigo Rojo", "Los Semiconductores", "Wattio FC", "Amperio 12", "Resistencia Roja", "Diodo Veloz",
  "Alto Voltaje", "Los Servos", "Fusible Feliz", "Placa Base", "Corriente Alterna", "Relé Rápido",
  "Batería Baja", "Modo Turbo", "Los Precisos", "Cero Fricción", "Sensor Ultra", "Garra de Acero",
  "Chatarra Voladora", "Metal Pesado", "Los Silenciosos", "Doble Motor",
];
const INSTITUTIONS = [
  "Escuela N°5", "IPET 20", "Escuela Técnica N°1", "Colegio San Martín", "EPET N°3", "Instituto Confluencia",
  "UTN Neuquén", "Patagonia Robotics", "Escuela N°12", "IPET 14", "Colegio del Valle", "EPET N°9",
  "Instituto Don Bosco", "Escuela N°30", "IPET 33", "Colegio Cutral Có",
];
const FIRST_NAMES = ["Sofía", "Mateo", "Valentina", "Bruno", "Emma", "Tomás", "Lucía", "Joaquín", "Martina", "Benicio"];

let teamCounter = 0;
export function makeTeamRow(competitionId: string, disciplineSlug: string, i: number) {
  const name = TEAM_ADJ[teamCounter % TEAM_ADJ.length];
  const institution = INSTITUTIONS[teamCounter % INSTITUTIONS.length];
  teamCounter++;
  const isFutbol = disciplineSlug === "futbol";
  const members = Array.from({ length: 2 + (i % 3) }, (_, j) => FIRST_NAMES[(i + j) % FIRST_NAMES.length]).join(", ");
  return {
    competition_id: competitionId,
    name,
    institution,
    mentor_name: "Prof. " + institution.split(" ")[0],
    mentor_contact: "contacto@" + institution.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".edu.ar",
    member_count: 2 + (i % 3),
    member_names: members,
    robot_names: isFutbol ? `${name} I (titular), ${name} II (titular), ${name} III (suplente)` : null,
    accepted_terms_at: i % 2 === 0 ? new Date().toISOString() : null,
    accredited: true,
    accredited_at: new Date().toISOString(),
    homologated: true,
    homologated_at: new Date().toISOString(),
    participants_present: 2 + (i % 3),
  };
}

export async function makeGroupsAndMatches(competitionId: string, teams: { id: string }[], groupCount: number) {
  const groupIds: string[] = [];
  const perGroup = Math.ceil(teams.length / groupCount);
  for (let g = 0; g < groupCount; g++) {
    const { data } = await supabase
      .from("groups")
      .insert({ competition_id: competitionId, name: `Grupo ${String.fromCharCode(65 + g)}`, sort_order: g })
      .select("id")
      .single();
    groupIds.push(data!.id);
  }
  const slices = groupIds.map((_, g) => teams.slice(g * perGroup, (g + 1) * perGroup));
  const groupTeamRows = slices.flatMap((slice, g) => slice.map((t) => ({ group_id: groupIds[g], team_id: t.id })));
  await supabase.from("group_teams").insert(groupTeamRows);
  const matchRows = slices.flatMap((slice, g) =>
    generateRoundRobinPairs(slice.map((t) => t.id)).map(([a, b]) => ({
      competition_id: competitionId,
      phase: "group" as const,
      group_id: groupIds[g],
      team_a_id: a,
      team_b_id: b,
      status: "scheduled" as const,
    }))
  );
  const { data: inserted } = await supabase.from("matches").insert(matchRows).select("id, team_a_id, team_b_id");
  return { groupIds, matches: (inserted ?? []) as SchedulableMatch[] };
}

export interface PlanItem {
  disciplineSlug: string;
  categorySlug: string;
  formatType: FormatType;
  teamCount: number;
  groupCount: number;
}

// Plan: 5 disciplinas × 2 categorías = 10 competencias (tope real de la DB,
// unique(event_id, discipline_id, category_id) — no hay margen para las 4
// modalidades × 5 disciplinas en un solo evento). Se reparte para que cada
// disciplina pase por 2 modalidades distintas y las 4 modalidades queden
// cubiertas por al menos 2 disciplinas cada una.
export const PLAN: PlanItem[] = [
  { disciplineSlug: "futbol", categorySlug: "infantil", formatType: "groups_only", teamCount: 6, groupCount: 2 },
  { disciplineSlug: "futbol", categorySlug: "juvenil_adultos", formatType: "single_elimination", teamCount: 6, groupCount: 2 },
  { disciplineSlug: "sumo_autonomo", categorySlug: "infantil", formatType: "gold_silver", teamCount: 8, groupCount: 2 },
  { disciplineSlug: "sumo_autonomo", categorySlug: "juvenil_adultos", formatType: "bracket_only", teamCount: 6, groupCount: 0 },
  { disciplineSlug: "sumo_rc", categorySlug: "infantil", formatType: "single_elimination", teamCount: 6, groupCount: 2 },
  { disciplineSlug: "sumo_rc", categorySlug: "juvenil_adultos", formatType: "groups_only", teamCount: 6, groupCount: 2 },
  { disciplineSlug: "minisumo_autonomo", categorySlug: "infantil", formatType: "bracket_only", teamCount: 6, groupCount: 0 },
  { disciplineSlug: "minisumo_autonomo", categorySlug: "juvenil_adultos", formatType: "gold_silver", teamCount: 8, groupCount: 2 },
  { disciplineSlug: "minisumo_rc", categorySlug: "infantil", formatType: "groups_only", teamCount: 6, groupCount: 2 },
  { disciplineSlug: "minisumo_rc", categorySlug: "juvenil_adultos", formatType: "single_elimination", teamCount: 6, groupCount: 2 },
];

export type { SupabaseClient };
