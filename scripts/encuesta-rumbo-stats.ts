// Números reales para "Rumbo a la 3ª edición" (lib/encuesta/rumbo.ts):
// robots y participaciones de los eventos de un año, desde la base. SOLO
// LEE. Uso:
//   node --env-file=.env.local --import tsx scripts/encuesta-rumbo-stats.ts [año]
//
// Criterio (SPEC §6): cuenta equipos acreditados (si un evento no usó la
// acreditación, todos los inscriptos). Robots = los nombres cargados en
// robot_names (fútbol) o, si no hay, 2 por equipo de fútbol y 1 por equipo
// del resto. Participaciones = integrantes (member_count) de esos equipos.

import { createClient } from "@supabase/supabase-js";

const year = Number(process.argv[2] ?? 2026);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type TeamRow = {
  accredited: boolean;
  member_count: number | null;
  robot_names: string | null;
  competition: { event_id: string; discipline: { slug: string; name: string } | null } | null;
};

async function main() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date")
    .gte("event_date", `${year}-01-01`)
    .lte("event_date", `${year}-12-31`)
    .order("event_date");
  if (error) throw error;

  let totalRobots = 0;
  let totalPart = 0;
  let counted = 0;
  for (const ev of events ?? []) {
    // Eventos de prueba (cargas, simulaciones): no cuentan.
    if (/prueba|simulaci/i.test(ev.name)) {
      console.log(`${ev.event_date}  ${ev.name}  — salteado (prueba)`);
      continue;
    }
    const { data, error: e2 } = await supabase
      .from("teams")
      .select("accredited, member_count, robot_names, competition:competitions!inner(event_id, discipline:disciplines(slug, name))")
      .eq("competition.event_id", ev.id);
    if (e2) throw e2;
    const all = (data ?? []) as unknown as TeamRow[];
    const acc = all.filter((t) => t.accredited);
    const teams = acc.length ? acc : all;
    let robots = 0;
    let part = 0;
    for (const t of teams) {
      const isFutbol = /futbol|fútbol/i.test(`${t.competition?.discipline?.slug} ${t.competition?.discipline?.name}`);
      const named = (t.robot_names ?? "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean).length;
      robots += named || (isFutbol ? 2 : 1);
      part += t.member_count ?? 0;
    }
    totalRobots += robots;
    totalPart += part;
    counted += 1;
    console.log(
      `${ev.event_date}  ${ev.name}\n  equipos: ${teams.length}${acc.length ? " (acreditados)" : " (inscriptos, sin acreditación)"} · robots: ${robots} · participaciones: ${part}`
    );
  }
  console.log(`\nTOTAL ${year}: robots ${totalRobots} · participaciones ${totalPart} (${counted} eventos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
