// Fase 3: termina los 3 torneos que se dejaron a mitad de jugar para probar
// la cancha del juez / inscripción / acreditación por la interfaz real
// (ver conversación — no forma parte del flujo normal sim-1/sim-2), y deja
// el evento entero 'finished' otra vez.
import {
  supabase,
  completeMatch,
  maybeAdvanceCompetitionPhase,
  generateBracketForCompetition,
  playBracketToCompletion,
  autoScheduleAndPersist,
} from "./sim-lib";
import { generateRoundRobinPairs } from "../lib/round-robin";

const EVENT_ID = "6dfe1448-8200-41be-bbba-4868bc6906ce";

async function finishGroupsOnly(competitionId: string, hasScore: boolean, allowDraws: boolean) {
  const { data: pending } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("competition_id", competitionId)
    .eq("phase", "group")
    .neq("status", "completed");
  for (const [i, m] of (pending ?? []).entries()) {
    await completeMatch(m as any, { allowDraws, hasScore, rngSeed: i + 5 });
  }
  await maybeAdvanceCompetitionPhase(competitionId);
  const { data: c } = await supabase.from("competitions").select("status").eq("id", competitionId).single();
  console.log(`  ${competitionId} -> ${c?.status}`);
}

async function main() {
  console.log("Fútbol Robótico — Infantil (5 partidos de grupo restantes)...");
  await finishGroupsOnly("60ef91fd-a914-4137-88c0-46f0228c0623", true, true);

  console.log("Mini Sumo Radio-controlado — Infantil (5 partidos de grupo restantes)...");
  await finishGroupsOnly("5aa4a423-0a90-4ba9-8076-2db5f5a0172a", false, false);

  console.log("Fútbol Robótico — Juvenil/Adultos (7mo equipo inscripto por el form público)...");
  const compId = "fd90f58d-4d6f-4977-91d2-f72580d749f8";
  const { data: comp } = await supabase.from("competitions").select("*").eq("id", compId).single();
  const { data: groups } = await supabase.from("groups").select("id, name").eq("competition_id", compId).order("sort_order");
  const groupA = groups!.find((g) => g.name === "Grupo A")!;
  const { data: newTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("competition_id", compId)
    .eq("name", "Fénix Binario")
    .single();
  await supabase.from("group_teams").insert({ group_id: groupA.id, team_id: newTeam!.id });
  console.log("  Fénix Binario asignado a Grupo A.");

  const matchRows: any[] = [];
  for (const g of groups!) {
    const { data: gt } = await supabase.from("group_teams").select("team_id").eq("group_id", g.id);
    const teamIds = (gt ?? []).map((r) => r.team_id);
    for (const [a, b] of generateRoundRobinPairs(teamIds)) {
      matchRows.push({ competition_id: compId, phase: "group", group_id: g.id, team_a_id: a, team_b_id: b, status: "scheduled" });
    }
  }
  const { data: inserted } = await supabase.from("matches").insert(matchRows).select("id, team_a_id, team_b_id");
  await autoScheduleAndPersist(EVENT_ID, comp!.discipline_id, inserted as any);
  await supabase.from("competitions").update({ status: "groups_in_progress", registration_open: false }).eq("id", compId);
  console.log(`  ${inserted!.length} partidos de grupo generados (con el 7mo equipo incluido).`);

  for (const [i, m] of (inserted ?? []).entries()) {
    await completeMatch(m as any, { allowDraws: true, hasScore: true, rngSeed: i + 2 });
  }
  await maybeAdvanceCompetitionPhase(compId); // genera el cuadro (single_elimination)
  await playBracketToCompletion(compId, true, true);
  await maybeAdvanceCompetitionPhase(compId);
  const { data: finalComp } = await supabase.from("competitions").select("status").eq("id", compId).single();
  console.log(`  ${compId} -> ${finalComp?.status}`);

  console.log("\nChequeo final de las 10 competencias...");
  const { data: allComps } = await supabase.from("competitions").select("id, status").eq("event_id", EVENT_ID);
  const unfinished = (allComps ?? []).filter((c) => c.status !== "finished");
  if (unfinished.length > 0) {
    console.warn("⚠️ sin terminar:", unfinished);
  } else {
    console.log("✅ Las 10 competencias están 'finished'.");
  }

  await supabase.from("events").update({ status: "finished" }).eq("id", EVENT_ID);
  console.log("✅ Evento marcado 'finished' de nuevo.");
}

main().catch((err) => {
  console.error("❌ Error en fase 3:", err.message ?? err);
  process.exit(1);
});
