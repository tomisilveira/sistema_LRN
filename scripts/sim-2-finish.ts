// Fase 2 de la simulación E2E: termina TODOS los partidos de grupo que
// quedaron pendientes/en curso, genera los cuadros de eliminatoria que
// correspondan (single_elimination, gold_silver, bracket_only) exactamente
// como lo haría maybeAdvanceCompetitionPhase, juega esos cuadros completos
// hasta la final, y cierra el evento entero.
//
// Uso: node --env-file=.env.local --import tsx scripts/sim-2-finish.ts

import {
  supabase,
  loadState,
  completeMatch,
  maybeAdvanceCompetitionPhase,
  generateBracketForCompetition,
  playBracketToCompletion,
  PLAN,
} from "./sim-lib";

async function main() {
  const { eventId, compIds } = loadState();
  console.log(`Cerrando simulación del evento ${eventId}...`);

  for (const item of PLAN) {
    const compId = compIds[`${item.disciplineSlug}|${item.categorySlug}`];
    console.log(`\nTorneo: ${item.disciplineSlug} / ${item.categorySlug} / ${item.formatType}`);
    const hasScore = item.disciplineSlug === "futbol";
    const allowDraws = item.disciplineSlug === "futbol";

    if (item.formatType === "bracket_only") {
      console.log("  Generando cuadro directo...");
      await generateBracketForCompetition(compId);
      await playBracketToCompletion(compId, hasScore, allowDraws);
      await maybeAdvanceCompetitionPhase(compId);
    } else {
      // Termina cualquier partido de grupo que haya quedado sin jugar (los
      // que la fase 1 dejó "en curso" incluidos).
      const { data: pending } = await supabase
        .from("matches")
        .select("id, team_a_id, team_b_id")
        .eq("competition_id", compId)
        .eq("phase", "group")
        .neq("status", "completed");
      for (const [i, m] of (pending ?? []).entries()) {
        await completeMatch(m, { allowDraws, hasScore, rngSeed: i + 3 });
      }
      console.log(`  ${(pending ?? []).length} partidos de grupo restantes completados.`);

      // Dispara generación de cuadro (single_elimination/gold_silver) o
      // cierre directo (groups_only) — igual que lib/advance-competition-phase.ts.
      await maybeAdvanceCompetitionPhase(compId);

      if (item.formatType === "single_elimination" || item.formatType === "gold_silver") {
        console.log("  Jugando cuadro de eliminatoria hasta la final...");
        await playBracketToCompletion(compId, hasScore, allowDraws);
        await maybeAdvanceCompetitionPhase(compId);
      }
    }

    const { data: finalComp } = await supabase.from("competitions").select("status").eq("id", compId).single();
    console.log(`  Estado final del torneo: ${finalComp?.status}`);
  }

  // Chequeo final: todas las competencias del evento deben quedar 'finished'.
  const { data: allComps } = await supabase.from("competitions").select("id, status").eq("event_id", eventId);
  const unfinished = (allComps ?? []).filter((c) => c.status !== "finished");
  if (unfinished.length > 0) {
    console.warn(`⚠️  ${unfinished.length} competencia(s) no quedaron 'finished':`, unfinished);
  } else {
    console.log("\n✅ Las 10 competencias quedaron 'finished'.");
  }

  console.log("Cerrando el evento (status = 'finished')...");
  await supabase.from("events").update({ status: "finished" }).eq("id", eventId);

  console.log("\n🏁 Simulación completa.");
  console.log(`   Evento:        ${eventId}`);
  console.log(`   Panel admin:   /admin/eventos/${eventId}`);
  console.log(`   Vista pública: /publico/${eventId}`);
  console.log(`   Pantalla:      /evento/${eventId}/pantalla`);
}

main().catch((err) => {
  console.error("❌ Error en fase 2:", err.message ?? err);
  process.exit(1);
});
