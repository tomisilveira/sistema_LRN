// Fase 1 de la simulación E2E: crea el evento de prueba, sus canchas y las
// 10 competencias del plan (ver PLAN en sim-lib.ts — 5 disciplinas × 2
// categorías, repartiendo los 4 format_type existentes), con equipos
// ficticios inscriptos y la fase de grupos generada y auto-programada.
// Completa la mayoría de los partidos de grupo con resultados variados y
// deja un par en curso / en pausa para poder mirar la pantalla del evento
// en vivo antes de correr la fase 2 (scripts/sim-2-finish.ts).
//
// Uso: node --env-file=.env.local --import tsx scripts/sim-1-setup.ts

import { supabase, saveState, autoScheduleAndPersist, makeTeamRow, makeGroupsAndMatches, completeMatch, PLAN } from "./sim-lib";

async function main() {
  const { data: disciplines } = await supabase.from("disciplines").select("id, slug, name");
  const { data: categories } = await supabase.from("categories").select("id, slug");
  const categoryId = (slug: string) => categories!.find((c) => c.slug === slug)!.id;

  console.log("Creando evento de prueba...");
  const today = new Date().toISOString().slice(0, 10);
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .insert({ name: "Simulación E2E — Todas las disciplinas y modalidades", event_date: today, status: "active", is_public: true })
    .select("id")
    .single();
  if (eventErr || !event) throw eventErr ?? new Error("No se pudo crear el evento");
  const eventId = event.id;
  console.log(`  Evento: ${eventId}`);

  console.log("Creando 2 canchas por disciplina (10 en total)...");
  const courtRows = disciplines!.flatMap((d) => [
    { event_id: eventId, name: `${d.name} — Cancha 1`, discipline_id: d.id, sort_order: 0 },
    { event_id: eventId, name: `${d.name} — Cancha 2`, discipline_id: d.id, sort_order: 1 },
  ]);
  const { data: courts } = await supabase.from("courts").insert(courtRows).select("id, name, access_token, discipline_id");
  console.log(`  ${courts!.length} canchas creadas.`);

  const compIds: Record<string, string> = {}; // "slug|category" -> competitionId

  const { data: disciplinesFull } = await supabase
    .from("disciplines")
    .select("id, slug, name, timer_mode_default, period_seconds_default, periods_count_default, rounds_to_win_default");

  for (const item of PLAN) {
    console.log(`\nTorneo: ${item.disciplineSlug} / ${item.categorySlug} / ${item.formatType} (${item.teamCount} equipos)`);
    const disc = disciplinesFull!.find((d) => d.slug === item.disciplineSlug)!;
    // Igual que createCompetitionAction: copia el timer por defecto de la
    // disciplina a la competencia (si no, queda 'Sin reloj configurado').
    const { data: comp, error: compErr } = await supabase
      .from("competitions")
      .insert({
        event_id: eventId,
        discipline_id: disc.id,
        category_id: categoryId(item.categorySlug),
        format_type: item.formatType,
        allow_draws: item.disciplineSlug === "futbol",
        points_win: 3,
        points_draw: item.disciplineSlug === "futbol" ? 1 : 0,
        points_loss: 0,
        qualifiers_per_group: 2,
        timer_mode: disc.timer_mode_default ?? "periods",
        period_seconds: disc.period_seconds_default ?? null,
        periods_count: disc.periods_count_default ?? 1,
        rounds_to_win: disc.rounds_to_win_default ?? null,
      })
      .select("*")
      .single();
    if (compErr || !comp) throw compErr ?? new Error("No se pudo crear la competencia");
    compIds[`${item.disciplineSlug}|${item.categorySlug}`] = comp.id;

    const teamsInsert = Array.from({ length: item.teamCount }, (_, i) => makeTeamRow(comp.id, item.disciplineSlug, i));
    const { data: teams, error: teamsErr } = await supabase.from("teams").insert(teamsInsert).select("id, name");
    if (teamsErr || !teams) throw teamsErr ?? new Error("No se pudieron crear los equipos");
    console.log(`  ${teams.length} equipos inscriptos: ${teams.map((t) => t.name).join(", ")}`);

    if (item.formatType === "bracket_only") {
      // Sin fase de grupos — queda en 'setup' con los equipos cargados,
      // listo para que la fase 2 genere el cuadro directo.
      continue;
    }

    const { matches } = await makeGroupsAndMatches(comp.id, teams, item.groupCount);
    await autoScheduleAndPersist(eventId, disc.id, matches);
    await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", comp.id);
    console.log(`  ${matches.length} partidos de grupo generados y programados.`);

    // Completa la mayoría de los partidos con resultado variado; deja el
    // último "vivo" (in_progress, uno pausado) para poder ver el estado en
    // curso en la pantalla del evento antes de cerrar todo en la fase 2.
    const hasScore = item.disciplineSlug === "futbol";
    const toComplete = matches.slice(0, matches.length - 1);
    for (const [i, m] of toComplete.entries()) {
      await completeMatch(m, { allowDraws: item.disciplineSlug === "futbol", hasScore, rngSeed: i + 1 });
    }
    const live = matches[matches.length - 1];
    if (live && live.team_a_id && live.team_b_id) {
      const now = new Date().toISOString();
      const { data: court } = await supabase
        .from("courts")
        .select("id")
        .eq("event_id", eventId)
        .eq("discipline_id", disc.id)
        .limit(1)
        .single();
      await supabase
        .from("matches")
        .update({
          status: "in_progress",
          started_at: now,
          court_id: court?.id ?? null,
          ...(hasScore ? { score_a: 1, score_b: 0 } : {}),
          timer_running_since: now,
          timer_elapsed_seconds: 40,
          current_period: 1,
          ...(hasScore ? {} : { round_winner_ids: [] }),
        })
        .eq("id", live.id);
      console.log(`  Partido en curso dejado en vivo: ${live.id}`);
    }
  }

  saveState({ eventId, compIds });
  console.log("\n✅ Fase 1 lista.");
  console.log(`   Evento: ${eventId}`);
  console.log(`   Panel admin:   /admin/eventos/${eventId}`);
  console.log(`   Vista pública: /publico/${eventId}`);
  console.log(`   Pantalla:      /evento/${eventId}/pantalla`);
  console.log("\nCorré scripts/sim-2-finish.ts para terminar todos los partidos, generar los cuadros y cerrar el evento.");
}

main().catch((err) => {
  console.error("❌ Error en fase 1:", err.message ?? err);
  process.exit(1);
});
