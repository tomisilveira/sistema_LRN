// Simulación completa para ver el sistema andando: 1 evento con 4 canchas,
// 3 torneos (2 de fútbol —una con cuadro ya armado y en curso, otra con
// grupos a mitad de jugar— y 1 de sumo con rounds), equipos acreditados,
// partidos ya jugados (para posiciones), uno en curso por cancha y uno en
// pausa, para ver de un saque casi todos los estados de la UI.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/seed-full-demo.ts
//
// Reusa las mismas funciones que usa la app de verdad (autoScheduleAndPersist,
// generateBracketForCompetition, computeMatchOutcome) en vez de insertar
// cancha/turno/ganador a mano, para que el estado quede igual de consistente
// que si un admin lo hubiera cargado a mano.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateRoundRobinPairs } from "../lib/round-robin";
import { autoScheduleMatches, type SchedulableMatch } from "../lib/auto-schedule";
import { buildSeedOrder, generateBracketRounds, type BracketRound } from "../lib/bracket";
import { computeMatchOutcome } from "../lib/match-logic";

// lib/apply-auto-schedule.ts, lib/generate-bracket-for-competition.ts y
// lib/bracket-actions.ts tienen `import "server-only"` (se rompen fuera del
// build de Next) — este script reusa sus mismos algoritmos puros
// (auto-schedule.ts, bracket.ts) pero repite acá la parte de persistencia en
// Supabase, igual que hacen esos archivos.

/** Igual que lib/apply-auto-schedule.ts: asigna cancha+turno a una tanda de
 * partidos recién creados, usando las canchas de la disciplina si hay. */
async function autoScheduleAndPersist(
  supabase: SupabaseClient,
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

/** Igual que lib/bracket-actions.ts persistBracket + advanceWinner: inserta
 * las rondas encadenadas por next_match_id/next_match_slot, resolviendo los
 * "byes" de la ronda 1 como completed y empujando ese ganador a la ronda 2. */
async function persistBracket(supabase: SupabaseClient, competitionId: string, rounds: BracketRound[]): Promise<void> {
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
      await advanceWinnerDemo(supabase, m);
    }
  }
}

/** Igual que lib/bracket-actions.ts advanceWinner: empuja el ganador a la
 * siguiente ronda y, si con eso ya están los dos equipos, pasa esa ronda de
 * "pending_teams" a "scheduled" (si no, el partido queda invisible para el
 * juez de cancha aunque ya tenga rival y cancha asignada). */
async function advanceWinnerDemo(
  supabase: SupabaseClient,
  match: { next_match_id: string | null; next_match_slot: "a" | "b" | null; winner_id: string | null }
): Promise<void> {
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

/** Igual que lib/generate-bracket-for-competition.ts: arma el cuadro a
 * partir de la tabla de posiciones de cada grupo y asigna cancha/turno. */
async function generateBracketForCompetition(supabase: SupabaseClient, competitionId: string): Promise<void> {
  const { data: competition } = await supabase.from("competitions").select("*").eq("id", competitionId).single();
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", competitionId)
    .order("sort_order");
  const qualifiersByGroup = [];
  for (const g of groups ?? []) {
    const { data: standings } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
    const rows = standings ?? [];
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.slice(0, competition.qualifiers_per_group).map((r: { team_id: string; team_name: string }, i: number) => ({
        teamId: r.team_id,
        teamName: r.team_name,
        rank: i + 1,
      })),
    });
  }
  const seedTeams = buildSeedOrder(qualifiersByGroup);
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, rounds);

  const { data: bracketMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("competition_id", competitionId)
    .eq("phase", "bracket")
    .neq("status", "completed");
  await autoScheduleAndPersist(
    supabase,
    competition.event_id,
    competition.discipline_id,
    (bracketMatches ?? []) as SchedulableMatch[]
  );
  await supabase.from("competitions").update({ status: "bracket_in_progress" }).eq("id", competitionId);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ¿Ya se corrió 0006_match_timer.sql? Si no, seguimos igual pero sin tocar
// las columnas nuevas (se caen solas al fallback "sin reloj configurado").
async function hasTimerColumns(): Promise<boolean> {
  const { error } = await supabase.from("competitions").select("timer_mode").limit(1);
  return !error;
}

function teamRow(competitionId: string, name: string, institution: string) {
  return {
    competition_id: competitionId,
    name,
    institution,
    mentor_name: "Prof. " + institution.split(" ")[0],
    mentor_contact: "contacto@" + institution.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".edu.ar",
    member_count: 3 + Math.floor(Math.random() * 3),
    accredited: true,
    accredited_at: new Date().toISOString(),
    homologated: true,
    homologated_at: new Date().toISOString(),
    participants_present: 2 + Math.floor(Math.random() * 3),
  };
}

async function makeGroupsAndMatches(competitionId: string, teams: { id: string }[], groupCount: number) {
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

async function main() {
  const timerColumnsOk = await hasTimerColumns();
  console.log(
    timerColumnsOk
      ? "0006_match_timer.sql detectada — voy a simular el reloj (en curso/pausado/rounds) también."
      : "0006_match_timer.sql NO corrida todavía — armo igual la simulación, pero el reloj va a caer al cartel 'Sin reloj configurado' hasta que la corras."
  );

  const { data: disciplines } = await supabase.from("disciplines").select("id, slug");
  const disciplineId = (slug: string) => disciplines!.find((d) => d.slug === slug)!.id;
  const { data: categories } = await supabase.from("categories").select("id, slug");
  const categoryId = (slug: string) => categories!.find((c) => c.slug === slug)!.id;

  console.log("Creando evento...");
  const today = new Date().toISOString().slice(0, 10);
  const { data: event } = await supabase
    .from("events")
    .insert({ name: "Simulación Completa LRN", event_date: today, status: "active", is_public: true })
    .select("id")
    .single();
  const eventId = event!.id;

  console.log("Creando 4 canchas (2 fútbol, 2 sumo)...");
  const { data: courts } = await supabase
    .from("courts")
    .insert([
      { event_id: eventId, name: "Cancha 1", discipline_id: disciplineId("futbol"), sort_order: 0 },
      { event_id: eventId, name: "Cancha 2", discipline_id: disciplineId("futbol"), sort_order: 1 },
      { event_id: eventId, name: "Cancha 3", discipline_id: disciplineId("sumo_autonomo"), sort_order: 2 },
      { event_id: eventId, name: "Cancha 4", discipline_id: disciplineId("sumo_autonomo"), sort_order: 3 },
    ])
    .select("id, access_token, name");
  const courtByName = new Map(courts!.map((c) => [c.name, c]));

  // ==========================================================================
  // Torneo 1: Fútbol Infantil — grupos completos + cuadro ya armado y un
  // partido de cuadro en curso (para ver BracketView + reloj en vivo).
  // ==========================================================================
  console.log("Torneo 1: Fútbol Robótico — Infantil (grupos completos + cuadro)...");
  const { data: compFutbolInfantil } = await supabase
    .from("competitions")
    .insert({
      event_id: eventId,
      discipline_id: disciplineId("futbol"),
      category_id: categoryId("infantil"),
      format_type: "single_elimination",
      allow_draws: true,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      qualifiers_per_group: 2,
      ...(timerColumnsOk ? { timer_mode: "periods", period_seconds: 240, periods_count: 2 } : {}),
    })
    .select("*")
    .single();
  const compFI = compFutbolInfantil!.id;

  const teamsFIInsert = [
    teamRow(compFI, "Los Tornillos", "Escuela N°5"),
    teamRow(compFI, "Circuito Azul", "IPET 20"),
    teamRow(compFI, "Robotines FC", "Escuela Técnica N°1"),
    teamRow(compFI, "Chispa Robótica", "Colegio San Martín"),
    teamRow(compFI, "Engranaje Rojo", "EPET N°3"),
    teamRow(compFI, "Pixel Bots", "Instituto Confluencia"),
  ];
  const { data: teamsFI } = await supabase.from("teams").insert(teamsFIInsert).select("id, name");
  const { matches: matchesFI } = await makeGroupsAndMatches(compFI, teamsFI!, 2);
  await autoScheduleAndPersist(supabase, eventId, disciplineId("futbol"), matchesFI);
  await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", compFI);

  // Completa TODOS los partidos de grupo con marcador variado.
  for (const [i, m] of matchesFI.entries()) {
    const scoreA = i % 3;
    const scoreB = (i + 2) % 3;
    const outcome = computeMatchOutcome({
      allowDraws: true,
      teamAId: m.team_a_id!,
      teamBId: m.team_b_id!,
      scoreA,
      scoreB,
    });
    await supabase
      .from("matches")
      .update({ score_a: scoreA, score_b: scoreB, winner_id: outcome.winner_id, status: "completed" })
      .eq("id", m.id);
  }

  console.log("  Generando cuadro de eliminatoria...");
  await generateBracketForCompetition(supabase, compFI);

  const { data: bracketFI } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, status")
    .eq("competition_id", compFI)
    .eq("phase", "bracket")
    .eq("round", "SF")
    .order("bracket_slot");
  const liveBracketMatch = (bracketFI ?? []).find((m) => m.team_a_id && m.team_b_id && m.status !== "completed");
  if (liveBracketMatch) {
    const now = new Date().toISOString();
    await supabase
      .from("matches")
      .update({
        status: "in_progress",
        started_at: now,
        court_id: courtByName.get("Cancha 1")!.id,
        score_a: 1,
        score_b: 0,
        ...(timerColumnsOk
          ? { timer_running_since: now, timer_elapsed_seconds: 45, current_period: 1 }
          : {}),
      })
      .eq("id", liveBracketMatch.id);
    console.log(`  Semifinal en curso en Cancha 1 (1-0, corriendo).`);
  }

  // ==========================================================================
  // Torneo 2: Fútbol Juvenil/Adultos — grupos a mitad de jugar, un partido
  // EN PAUSA en Cancha 2 (para ver el cartel "Pausado" en público y juez).
  // ==========================================================================
  console.log("Torneo 2: Fútbol Robótico — Juvenil/Adultos (grupos a mitad de jugar)...");
  const { data: compFutbolJuvenil } = await supabase
    .from("competitions")
    .insert({
      event_id: eventId,
      discipline_id: disciplineId("futbol"),
      category_id: categoryId("juvenil_adultos"),
      format_type: "groups_only",
      allow_draws: true,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      qualifiers_per_group: 2,
      ...(timerColumnsOk ? { timer_mode: "periods", period_seconds: 300, periods_count: 2 } : {}),
    })
    .select("id")
    .single();
  const compFJ = compFutbolJuvenil!.id;

  const teamsFJInsert = [
    teamRow(compFJ, "Neuquén FC Robots", "UTN Neuquén"),
    teamRow(compFJ, "Los Halcones de Acero", "Escuela Técnica N°1"),
    teamRow(compFJ, "Team Voltaje", "IPET 20"),
    teamRow(compFJ, "Escuadrón Binario", "Servomotores FC"),
    teamRow(compFJ, "Turbo Sur", "Patagonia Robotics"),
    teamRow(compFJ, "Los Autómatas", "Bytes del Sur"),
  ];
  const { data: teamsFJ } = await supabase.from("teams").insert(teamsFJInsert).select("id, name");
  const { matches: matchesFJ } = await makeGroupsAndMatches(compFJ, teamsFJ!, 2);
  await autoScheduleAndPersist(supabase, eventId, disciplineId("futbol"), matchesFJ);
  await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", compFJ);

  // Completa un poco más de la mitad, deja uno pausado y el resto programado.
  const halfFJ = Math.ceil(matchesFJ.length * 0.6);
  for (const [i, m] of matchesFJ.slice(0, halfFJ).entries()) {
    const scoreA = (i + 1) % 4;
    const scoreB = i % 3;
    const outcome = computeMatchOutcome({ allowDraws: true, teamAId: m.team_a_id!, teamBId: m.team_b_id!, scoreA, scoreB });
    await supabase
      .from("matches")
      .update({ score_a: scoreA, score_b: scoreB, winner_id: outcome.winner_id, status: "completed" })
      .eq("id", m.id);
  }
  const pausedMatch = matchesFJ[halfFJ];
  if (pausedMatch) {
    const startedAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    await supabase
      .from("matches")
      .update({
        status: "in_progress",
        started_at: startedAt,
        court_id: courtByName.get("Cancha 2")!.id,
        score_a: 2,
        score_b: 2,
        ...(timerColumnsOk
          ? { timer_running_since: null, timer_elapsed_seconds: 165, current_period: 1 }
          : {}),
      })
      .eq("id", pausedMatch.id);
    console.log("  Partido en PAUSA en Cancha 2 (2-2).");
  }

  // ==========================================================================
  // Torneo 3: Sumo Autónomo Infantil — rounds, uno en curso con 1 round ya
  // ganado (para ver los puntitos de round + botones "Ganó X").
  // ==========================================================================
  console.log("Torneo 3: Sumo Autónomo — Infantil (rounds, mejor de 3)...");
  const { data: compSumo } = await supabase
    .from("competitions")
    .insert({
      event_id: eventId,
      discipline_id: disciplineId("sumo_autonomo"),
      category_id: categoryId("infantil"),
      format_type: "groups_only",
      allow_draws: false,
      points_win: 3,
      points_draw: 0,
      points_loss: 0,
      qualifiers_per_group: 2,
      ...(timerColumnsOk ? { timer_mode: "rounds", period_seconds: 120, periods_count: 3, rounds_to_win: 2 } : {}),
    })
    .select("id")
    .single();
  const compS = compSumo!.id;

  const teamsSInsert = [
    teamRow(compS, "Sumo Rex", "Escuela N°5"),
    teamRow(compS, "Aplastador Jr", "IPET 20"),
    teamRow(compS, "Mini Titán", "Instituto Confluencia"),
    teamRow(compS, "Dohyo Kids", "Colegio San Martín"),
  ];
  const { data: teamsS } = await supabase.from("teams").insert(teamsSInsert).select("id, name");
  const { matches: matchesS } = await makeGroupsAndMatches(compS, teamsS!, 1);
  await autoScheduleAndPersist(supabase, eventId, disciplineId("sumo_autonomo"), matchesS);
  await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", compS);

  // Completa la mitad (ganador directo, sin marcador) y deja uno en curso.
  const halfS = Math.ceil(matchesS.length * 0.5);
  for (const [i, m] of matchesS.slice(0, halfS).entries()) {
    const winnerId = i % 2 === 0 ? m.team_a_id! : m.team_b_id!;
    const outcome = computeMatchOutcome({
      allowDraws: false,
      teamAId: m.team_a_id!,
      teamBId: m.team_b_id!,
      scoreA: null,
      scoreB: null,
      winnerIdIfNoScore: winnerId,
    });
    await supabase
      .from("matches")
      .update({ winner_id: outcome.winner_id, status: "completed" })
      .eq("id", m.id);
  }
  const liveSumoMatch = matchesS[halfS];
  if (liveSumoMatch) {
    const now = new Date().toISOString();
    await supabase
      .from("matches")
      .update({
        status: "in_progress",
        started_at: now,
        court_id: courtByName.get("Cancha 3")!.id,
        ...(timerColumnsOk
          ? {
              timer_running_since: now,
              timer_elapsed_seconds: 20,
              current_period: 2,
              round_winner_ids: [liveSumoMatch.team_a_id],
            }
          : {}),
      })
      .eq("id", liveSumoMatch.id);
    console.log("  Combate en curso en Cancha 3 (round 2, 1-0 corriendo).");
  }

  console.log("\n✅ Simulación cargada.");
  console.log(`   Evento: ${eventId}`);
  console.log(`   Panel admin:     /admin/eventos/${eventId}`);
  console.log(`   Vista pública:   /publico/${eventId}`);
  console.log(`   Modo pantalla:   /evento/${eventId}/pantalla`);
  console.log("   Links de juez (sin login):");
  for (const c of courts!) {
    console.log(`     ${c.name}: /juez/${c.access_token}`);
  }
  if (!timerColumnsOk) {
    console.log(
      "\n⚠️  Corré supabase/migrations/0006_match_timer.sql en el SQL Editor de Supabase y volvé a\n" +
        "   correr este script (o esperá al próximo partido) para ver el reloj/pausa/rounds reales."
    );
  }
}

main().catch((err) => {
  console.error("❌ Error en la simulación:", err.message ?? err);
  process.exit(1);
});
