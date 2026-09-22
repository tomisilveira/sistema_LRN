// One-off: carga 20 equipos en la competencia "Sumo Autónomo — Infantil"
// (copa oro / plata) del evento "Simulación Completa LRN" y juega el torneo
// completo — fase de grupos + cuadros de oro y plata con partido por el 3er
// puesto — dejando la competencia en 'finished'.
//
// Reimplementa fielmente la lógica server-only real (lib/bracket-actions.ts,
// lib/generate-bracket-for-competition.ts, lib/advance-competition-phase.ts,
// lib/apply-auto-schedule.ts) porque esos módulos no se pueden importar
// fuera del build de Next. Si esa lógica cambia, resincronizar.
//
// Uso: node --env-file=.env.local --import tsx scripts/sim-sumo-oro-plata.ts

import { supabase } from "./sim-lib";
import { generateRoundRobinPairs } from "../lib/round-robin";
import { autoScheduleMatches, type SchedulableMatch } from "../lib/auto-schedule";
import { buildSeedOrder, generateBracketRounds, type BracketRound } from "../lib/bracket";
import { computeMatchOutcome } from "../lib/match-logic";
import type { BracketType } from "../lib/database.types";

const EVENT_ID = "c7f6176e-6155-4daa-8aee-5433a7c100d7";
const COMP_ID = "7b3698c9-ae20-4af7-ba20-2aa77c58119f";
const GROUP_COUNT = 4; // 4 grupos de 5 → oro = 8 (cuadro limpio), plata = 12

// ── datos ficticios ───────────────────────────────────────────────────────
const TEAM_NAMES = [
  "Dohyo Kids", "Aplastador Jr", "Mini Titán", "Fuerza Bruta", "Relámpago Gris",
  "Garra de Acero", "Sumo Rex", "Chatarra Voladora", "Metal Pesado", "Cero Fricción",
  "Empuje Total", "Kraken Robótico", "Los Tornillos", "Chispa Robótica", "Engranaje Rojo",
  "Neuquén Robots", "Turbo Sur", "Placa Madre", "Vector Verde", "Alto Voltaje",
];
const INSTITUTIONS = [
  "Escuela N°5", "IPET 20", "Escuela Técnica N°1", "Colegio San Martín", "EPET N°3",
  "Instituto Confluencia", "Escuela N°12", "IPET 14", "Colegio del Valle", "EPET N°9",
  "Instituto Don Bosco", "Escuela N°30", "IPET 33", "Colegio Cutral Có", "Escuela N°2",
  "EPET N°15", "Colegio Plottier", "Escuela N°44", "IPET 8", "Instituto Senillosa",
];
const FIRST_NAMES = ["Sofía", "Mateo", "Valentina", "Bruno", "Emma", "Tomás", "Lucía", "Joaquín", "Martina", "Benicio"];

function makeTeamRow(i: number) {
  const name = TEAM_NAMES[i];
  const institution = INSTITUTIONS[i];
  const memberCount = 2 + (i % 3);
  const members = Array.from({ length: memberCount }, (_, j) => FIRST_NAMES[(i + j) % FIRST_NAMES.length]).join(", ");
  const now = new Date().toISOString();
  return {
    competition_id: COMP_ID,
    name,
    institution,
    mentor_name: "Prof. " + FIRST_NAMES[(i + 3) % FIRST_NAMES.length],
    mentor_contact: `contacto@${institution.toLowerCase().replace(/[^a-z0-9]+/g, "")}.edu.ar`,
    member_count: memberCount,
    member_names: members,
    robot_names: `${name} (autónomo)`,
    accepted_terms_at: now,
    accredited: true,
    accredited_at: now,
    homologated: true,
    homologated_at: now,
    participants_present: memberCount,
  };
}

// ── auto-scheduling (lib/apply-auto-schedule.ts) ──────────────────────────
async function autoScheduleAndPersist(matches: SchedulableMatch[]) {
  if (matches.length === 0) return;
  const { data: courts } = await supabase
    .from("courts")
    .select("id, discipline_id, sort_order")
    .eq("event_id", EVENT_ID)
    .order("sort_order");
  const list = courts ?? [];
  const { data: comp } = await supabase.from("competitions").select("discipline_id").eq("id", COMP_ID).single();
  const matching = list.filter((c) => c.discipline_id === comp!.discipline_id);
  const usable = (matching.length > 0 ? matching : list).map((c) => ({ id: c.id }));
  if (usable.length === 0) return;
  const assignments = autoScheduleMatches(matches, usable);
  for (const a of assignments) {
    await supabase.from("matches").update({ court_id: a.courtId, turno: a.turno }).eq("id", a.matchId);
  }
}

// ── persistencia del cuadro (lib/bracket-actions.ts) ──────────────────────
type MatchRow = {
  id: string;
  competition_id: string;
  round: string | null;
  bracket_type: BracketType | null;
  bracket_slot: number | null;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_match_slot: "a" | "b" | null;
  consolation_match_id: string | null;
  consolation_slot: "a" | "b" | null;
  created_at: string;
};

async function persistBracket(bracketType: BracketType | null, rounds: BracketRound[]) {
  const idsByRound: Record<number, Record<number, string>> = {};
  for (let r = rounds.length - 1; r >= 0; r--) {
    const round = rounds[r];
    const nextRoundIds = idsByRound[r + 1];
    const isRound1 = r === 0;
    const rows = round.matches.map((slot) => {
      const status = isRound1 ? (slot.isBye ? "completed" : "scheduled") : "pending_teams";
      const winnerId = isRound1 && slot.isBye ? slot.teamAId ?? slot.teamBId ?? null : null;
      let nextMatchId: string | null = null;
      let nextMatchSlot: "a" | "b" | null = null;
      if (nextRoundIds) {
        nextMatchId = nextRoundIds[Math.floor(slot.slot / 2)] ?? null;
        nextMatchSlot = slot.slot % 2 === 0 ? "a" : "b";
      }
      return {
        competition_id: COMP_ID,
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
    const { data, error } = await supabase.from("matches").insert(rows).select("id, bracket_slot");
    if (error) throw error;
    idsByRound[r] = {};
    for (const row of data ?? []) idsByRound[r][row.bracket_slot as number] = row.id as string;
  }

  // Partido por el 3er puesto (siempre que haya SF con 2 partidos + final).
  const sfIndex = rounds.findIndex((r) => r.round === "SF");
  const hasFinal = rounds.some((r) => r.round === "F");
  if (sfIndex >= 0 && rounds[sfIndex].matches.length === 2 && hasFinal) {
    const { data: consolation, error: consErr } = await supabase
      .from("matches")
      .insert({
        competition_id: COMP_ID,
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
        .update({ consolation_match_id: consolation.id, consolation_slot: Number(slot) === 0 ? "a" : "b" })
        .eq("id", matchId);
    }
  }

  const round1Ids = Object.values(idsByRound[0] ?? {});
  if (round1Ids.length === 0) return;
  const { data: round1Matches } = await supabase.from("matches").select("*").in("id", round1Ids);
  for (const match of (round1Matches ?? []) as MatchRow[]) {
    if (match.status === "completed" && match.winner_id) await advanceWinner(match);
  }
}

async function finalMustWaitForThirdPlace(target: MatchRow): Promise<boolean> {
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

async function pushTeamInto(targetMatchId: string, slot: "a" | "b", teamId: string) {
  const field = slot === "a" ? "team_a_id" : "team_b_id";
  const { data: target, error } = await supabase
    .from("matches")
    .update({ [field]: teamId })
    .eq("id", targetMatchId)
    .select("id, status, team_a_id, team_b_id, round, bracket_type, competition_id")
    .single<MatchRow>();
  if (error) throw error;
  if (!target) return;
  if (target.status === "pending_teams" && target.team_a_id && target.team_b_id) {
    if (await finalMustWaitForThirdPlace(target)) return;
    await supabase.from("matches").update({ status: "scheduled" }).eq("id", target.id);
  }
}

async function unblockFinalAfterThirdPlace(thirdPlaceMatch: MatchRow) {
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

async function advanceWinner(match: MatchRow) {
  if (match.round === "3P" && match.status === "completed") {
    await unblockFinalAfterThirdPlace(match);
    return;
  }
  if (!match.winner_id) return;
  if (match.next_match_id && match.next_match_slot) {
    await pushTeamInto(match.next_match_id, match.next_match_slot, match.winner_id);
  }
  if (match.consolation_match_id && match.consolation_slot && match.team_a_id && match.team_b_id) {
    const loserId = match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
    await pushTeamInto(match.consolation_match_id, match.consolation_slot, loserId);
  }
}

// ── generación del cuadro (lib/generate-bracket-for-competition.ts) ───────
async function bracketExists(bracketType: BracketType | null): Promise<boolean> {
  const base = supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", COMP_ID)
    .eq("phase", "bracket");
  const { count } = bracketType ? await base.eq("bracket_type", bracketType) : await base.is("bracket_type", null);
  return (count ?? 0) > 0;
}

type StandingRow = { team_id: string; team_name: string };

async function generateGroupBracket(
  bracketType: BracketType | null,
  select: (rows: StandingRow[]) => StandingRow[]
) {
  if (await bracketExists(bracketType)) return;
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", COMP_ID)
    .order("sort_order");
  const qualifiersByGroup = [];
  for (const g of groups ?? []) {
    const { data: standings } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
    const rows = select((standings ?? []) as StandingRow[]);
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.map((r, i) => ({ teamId: r.team_id, teamName: r.team_name, rank: i + 1 })),
    });
  }
  const seedTeams = buildSeedOrder(qualifiersByGroup);
  if (seedTeams.length < 2) return;
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(bracketType, rounds);
}

async function generateBracketForCompetition() {
  const { data: competition } = await supabase.from("competitions").select("*").eq("id", COMP_ID).single();
  await generateGroupBracket("gold", (s) => s.slice(0, competition!.qualifiers_per_group));
  await generateGroupBracket("silver", (s) => s.slice(competition!.qualifiers_per_group));

  const { data: bracketMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, round")
    .eq("competition_id", COMP_ID)
    .eq("phase", "bracket")
    .neq("status", "completed");
  const roundOrder = (round: string | null) =>
    ({ R32: 0, R16: 1, QF: 2, SF: 3, "3P": 4, F: 5 })[round ?? ""] ?? 3;
  const toSchedule = [...(bracketMatches ?? [])].sort((a, b) => roundOrder(a.round) - roundOrder(b.round));
  if (toSchedule.length > 0) await autoScheduleAndPersist(toSchedule as SchedulableMatch[]);

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", COMP_ID)
    .eq("phase", "bracket");
  if ((count ?? 0) > 0) {
    await supabase
      .from("competitions")
      .update({ status: "bracket_in_progress", registration_open: false })
      .eq("id", COMP_ID);
  }
}

// ── advance-competition-phase.ts (parte relevante) ────────────────────────
async function maybeAdvanceCompetitionPhase() {
  const { data: competition } = await supabase.from("competitions").select("*").eq("id", COMP_ID).single();
  if (!competition) return;

  if (competition.status === "groups_in_progress") {
    const { data: groupMatches } = await supabase
      .from("matches")
      .select("status")
      .eq("competition_id", COMP_ID)
      .eq("phase", "group");
    const allDone = !!groupMatches && groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");
    if (allDone) await generateBracketForCompetition();
  }

  if (competition.status === "bracket_in_progress") {
    const types: (BracketType | null)[] = ["gold", "silver"];
    const finalsDone = await Promise.all(
      types.map(async (bracketType) => {
        const base = supabase
          .from("matches")
          .select("status")
          .eq("competition_id", COMP_ID)
          .eq("phase", "bracket")
          .in("round", ["F", "3P"]);
        const { data: finalMatches } = bracketType
          ? await base.eq("bracket_type", bracketType)
          : await base.is("bracket_type", null);
        if (!finalMatches || finalMatches.length === 0) return true;
        return finalMatches.every((m) => m.status === "completed");
      })
    );
    if (finalsDone.every(Boolean)) {
      await supabase.from("competitions").update({ status: "finished" }).eq("id", COMP_ID);
    }
  }
}

// ── jugar partidos ───────────────────────────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickWinner(a: string, b: string, seed: number): string {
  // pseudo-aleatorio determinista, sesgado por los ids para que no salga
  // una fase de grupos perfectamente empatada
  const va = hash(a + ":" + seed) % 1000;
  const vb = hash(b + ":" + seed) % 1000;
  return va >= vb ? a : b;
}

async function playMatch(m: MatchRow, seed: number) {
  if (!m.team_a_id || !m.team_b_id) return;
  const winnerId = pickWinner(m.team_a_id, m.team_b_id, seed);
  const outcome = computeMatchOutcome({
    allowDraws: false,
    teamAId: m.team_a_id,
    teamBId: m.team_b_id,
    scoreA: null,
    scoreB: null,
    winnerIdIfNoScore: winnerId,
  });
  await supabase
    .from("matches")
    .update({ winner_id: outcome.winner_id, status: "completed" })
    .eq("id", m.id);
}

async function main() {
  console.log("Limpiando estado previo de la competencia...");
  const { data: oldGroups } = await supabase.from("groups").select("id").eq("competition_id", COMP_ID);
  const oldGroupIds = (oldGroups ?? []).map((g) => g.id);
  await supabase.from("matches").delete().eq("competition_id", COMP_ID);
  if (oldGroupIds.length) await supabase.from("group_teams").delete().in("group_id", oldGroupIds);
  await supabase.from("groups").delete().eq("competition_id", COMP_ID);
  await supabase.from("teams").delete().eq("competition_id", COMP_ID);
  await supabase
    .from("competitions")
    .update({ status: "setup", registration_open: true })
    .eq("id", COMP_ID);

  console.log("Creando 20 equipos...");
  const teamRows = Array.from({ length: 20 }, (_, i) => makeTeamRow(i));
  const { data: teams, error: teamsErr } = await supabase.from("teams").insert(teamRows).select("id, name");
  if (teamsErr || !teams) throw teamsErr ?? new Error("no se crearon equipos");
  console.log(`  ${teams.length} equipos: ${teams.map((t) => t.name).join(", ")}`);

  console.log(`Creando ${GROUP_COUNT} grupos y repartiendo equipos...`);
  const perGroup = Math.ceil(teams.length / GROUP_COUNT);
  const groupIds: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const { data } = await supabase
      .from("groups")
      .insert({ competition_id: COMP_ID, name: `Grupo ${String.fromCharCode(65 + g)}`, sort_order: g })
      .select("id")
      .single();
    groupIds.push(data!.id);
  }
  const slices = groupIds.map((_, g) => teams.slice(g * perGroup, (g + 1) * perGroup));
  await supabase
    .from("group_teams")
    .insert(slices.flatMap((slice, g) => slice.map((t) => ({ group_id: groupIds[g], team_id: t.id }))));

  console.log("Generando fixture round-robin de cada grupo...");
  const matchRows = slices.flatMap((slice, g) =>
    generateRoundRobinPairs(slice.map((t) => t.id)).map(([a, b]) => ({
      competition_id: COMP_ID,
      phase: "group" as const,
      group_id: groupIds[g],
      team_a_id: a,
      team_b_id: b,
      status: "scheduled" as const,
    }))
  );
  const { data: groupMatches } = await supabase.from("matches").insert(matchRows).select("*");
  await autoScheduleAndPersist((groupMatches ?? []) as SchedulableMatch[]);
  await supabase
    .from("competitions")
    .update({ status: "groups_in_progress", registration_open: false })
    .eq("id", COMP_ID);
  console.log(`  ${groupMatches!.length} partidos de grupo.`);

  console.log("Jugando la fase de grupos...");
  for (const [i, m] of ((groupMatches ?? []) as MatchRow[]).entries()) {
    await playMatch(m, i + 1);
  }

  console.log("Generando cuadros de oro y plata (+ 3er puesto)...");
  await maybeAdvanceCompetitionPhase();

  console.log("Jugando los cuadros...");
  let guard = 0;
  while (guard++ < 60) {
    const { data: ready } = await supabase
      .from("matches")
      .select("*")
      .eq("competition_id", COMP_ID)
      .eq("phase", "bracket")
      .eq("status", "scheduled");
    const list = (ready ?? []) as MatchRow[];
    if (list.length === 0) break;
    for (const [i, m] of list.entries()) {
      await playMatch(m, guard * 100 + i + 1);
      const { data: updated } = await supabase.from("matches").select("*").eq("id", m.id).single<MatchRow>();
      if (updated) await advanceWinner(updated);
    }
  }

  console.log("Cerrando la competencia...");
  await maybeAdvanceCompetitionPhase();

  const { data: finalComp } = await supabase.from("competitions").select("status").eq("id", COMP_ID).single();
  const { data: allMatches } = await supabase
    .from("matches")
    .select("phase, round, bracket_type, status")
    .eq("competition_id", COMP_ID);
  const pending = (allMatches ?? []).filter((m) => m.status !== "completed");
  console.log(`\n✅ Competencia: status = ${finalComp!.status}`);
  console.log(`   ${allMatches!.length} partidos, ${pending.length} sin completar`);
  if (pending.length) console.log("   PENDIENTES:", JSON.stringify(pending, null, 2));
  console.log(`\n   Panel:    /admin/eventos/${EVENT_ID}`);
  console.log(`   Pantalla: /evento/${EVENT_ID}/pantalla`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message ?? err);
  process.exit(1);
});
