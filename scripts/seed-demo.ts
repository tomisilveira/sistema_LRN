// Carga datos de prueba para poder probar el flujo completo del sistema:
// 1 evento, 1 competencia (Fútbol Robótico, Juvenil/Adultos, grupos +
// eliminatoria simple), 8 equipos en 2 grupos, 2 canchas.
//
// Uso:
//   npm run seed:demo
//
// Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
// (usa la service-role key porque corre fuera de una sesión de Supabase Auth).

import { createClient } from "@supabase/supabase-js";
import { generateRoundRobinPairs } from "../lib/round-robin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Corré: node --env-file=.env.local -r tsx scripts/seed-demo.ts (ver npm run seed:demo)"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_TEAM_NAMES = [
  "Los Circuitos",
  "Robotech Neuquén",
  "Escuela Técnica N°1",
  "Bytes del Sur",
  "IPET 20",
  "Team Confluencia",
  "Patagonia Robotics",
  "Servomotores FC",
];

async function main() {
  console.log("Buscando disciplina 'Fútbol Robótico' y categoría 'Juvenil/Adultos'...");
  const { data: discipline, error: discErr } = await supabase
    .from("disciplines")
    .select("id")
    .eq("slug", "futbol")
    .single();
  if (discErr || !discipline) throw new Error("No se encontró la disciplina. ¿Corriste la migración?");

  const { data: category, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "juvenil_adultos")
    .single();
  if (catErr || !category) throw new Error("No se encontró la categoría. ¿Corriste la migración?");

  console.log("Creando evento demo...");
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .insert({
      name: "Regional de Prueba (demo)",
      event_date: new Date().toISOString().slice(0, 10),
      status: "active",
    })
    .select("id")
    .single();
  if (eventErr) throw eventErr;

  console.log("Creando competencia...");
  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    .insert({
      event_id: event.id,
      discipline_id: discipline.id,
      category_id: category.id,
      format_type: "single_elimination",
      allow_draws: true,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      qualifiers_per_group: 2,
    })
    .select("id")
    .single();
  if (compErr) throw compErr;

  console.log("Creando canchas...");
  const { error: courtsErr } = await supabase
    .from("courts")
    .insert([
      { event_id: event.id, name: "Cancha 1", sort_order: 0 },
      { event_id: event.id, name: "Cancha 2", sort_order: 1 },
    ]);
  if (courtsErr) throw courtsErr;

  console.log("Cargando 8 equipos...");
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .insert(DEMO_TEAM_NAMES.map((name) => ({ competition_id: competition.id, name })))
    .select("id, name");
  if (teamsErr) throw teamsErr;

  console.log("Creando 2 grupos y repartiendo equipos...");
  const { data: groupA, error: gaErr } = await supabase
    .from("groups")
    .insert({ competition_id: competition.id, name: "Grupo A", sort_order: 0 })
    .select("id")
    .single();
  if (gaErr) throw gaErr;
  const { data: groupB, error: gbErr } = await supabase
    .from("groups")
    .insert({ competition_id: competition.id, name: "Grupo B", sort_order: 1 })
    .select("id")
    .single();
  if (gbErr) throw gbErr;

  const half = Math.ceil(teams.length / 2);
  const teamsA = teams.slice(0, half);
  const teamsB = teams.slice(half);

  const { error: gtErr } = await supabase.from("group_teams").insert([
    ...teamsA.map((t) => ({ group_id: groupA.id, team_id: t.id })),
    ...teamsB.map((t) => ({ group_id: groupB.id, team_id: t.id })),
  ]);
  if (gtErr) throw gtErr;

  console.log("Generando partidos de fase de grupos (todos contra todos)...");
  const matchRows = [
    ...generateRoundRobinPairs(teamsA.map((t) => t.id)).map(([a, b]) => ({
      competition_id: competition.id,
      phase: "group" as const,
      group_id: groupA.id,
      team_a_id: a,
      team_b_id: b,
      status: "scheduled" as const,
    })),
    ...generateRoundRobinPairs(teamsB.map((t) => t.id)).map(([a, b]) => ({
      competition_id: competition.id,
      phase: "group" as const,
      group_id: groupB.id,
      team_a_id: a,
      team_b_id: b,
      status: "scheduled" as const,
    })),
  ];
  const { error: matchesErr } = await supabase.from("matches").insert(matchRows);
  if (matchesErr) throw matchesErr;

  await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", competition.id);

  console.log("\n✅ Listo. Datos de prueba cargados:");
  console.log(`   Evento: ${event.id}`);
  console.log(`   Competencia: ${competition.id}`);
  console.log(`   Panel admin: /admin/eventos/${event.id}`);
  console.log(`   Vista pública: /publico/${event.id}/${competition.id}`);
  console.log(
    "\nRecordá crear un usuario admin en Supabase Auth y agregarlo a la tabla `admins` para poder entrar al panel (ver README)."
  );
}

main().catch((err) => {
  console.error("❌ Error al sembrar datos de prueba:", err.message ?? err);
  process.exit(1);
});
