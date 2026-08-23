import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeedOrder, generateBracketRounds } from "./bracket";
import { persistBracket } from "./bracket-actions";
import { autoScheduleAndPersist } from "./apply-auto-schedule";
import type { SchedulableMatch } from "./auto-schedule";
import type { BracketType, Competition, GroupStandingRow, Team } from "./database.types";

type StandingsSelector = (standings: GroupStandingRow[]) => GroupStandingRow[];

/** ¿Ya existe un cuadro de este `bracket_type` para la competencia? Se
 * chequea por tipo (no por `phase='bracket'` en general) para poder generar
 * oro y plata de forma independiente sin bloquearse entre sí. */
async function bracketExists(
  supabase: SupabaseClient,
  competitionId: string,
  bracketType: BracketType | null
): Promise<boolean> {
  const base = supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("phase", "bracket");
  const { count } = bracketType ? await base.eq("bracket_type", bracketType) : await base.is("bracket_type", null);
  return (count ?? 0) > 0;
}

/** Trae la tabla de posiciones de cada grupo y aplica `select` para decidir
 * qué filas entran al cuadro — top N clasificados para la copa oro,
 * el resto (sobrantes) para la copa plata. */
async function collectGroupSeeds(supabase: SupabaseClient, competitionId: string, select: StandingsSelector) {
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", competitionId)
    .order("sort_order");
  if (!groups || groups.length === 0) throw new Error("No hay grupos cargados.");

  const qualifiersByGroup = [];
  for (const g of groups) {
    const { data: standings, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
    if (error) throw new Error(error.message);
    const rows = select((standings ?? []) as GroupStandingRow[]);
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.map((r, i) => ({ teamId: r.team_id, teamName: r.team_name, rank: i + 1 })),
    });
  }
  return qualifiersByGroup;
}

/** Arma y persiste un cuadro a partir de la tabla de posiciones de los
 * grupos. No hace nada si ese `bracket_type` ya tiene cuadro generado, o si
 * `select` deja menos de 2 equipos en total (ej. copa plata cuando ningún
 * grupo tiene sobrantes) — en vez de tirar el error de
 * `generateBracketRounds`, simplemente no genera esa copa. */
async function generateGroupBracket(
  supabase: SupabaseClient,
  competitionId: string,
  bracketType: BracketType | null,
  select: StandingsSelector
): Promise<void> {
  if (await bracketExists(supabase, competitionId, bracketType)) return;

  const qualifiersByGroup = await collectGroupSeeds(supabase, competitionId, select);
  const seedTeams = buildSeedOrder(qualifiersByGroup);
  if (seedTeams.length < 2) return;

  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, bracketType, rounds);
}

/** Arma y persiste el cuadro de `format_type = 'bracket_only'`: sin fase de
 * grupos, siembra manual por `teams.seed_order` (los sin semilla quedan al
 * final, en orden de carga). */
async function generateBracketOnlyBracket(supabase: SupabaseClient, competitionId: string): Promise<void> {
  if (await bracketExists(supabase, competitionId, null)) return;

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("competition_id", competitionId)
    .order("seed_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const teamList = (teams ?? []) as Team[];
  if (teamList.length < 2) throw new Error("Cargá al menos 2 equipos antes de generar el cuadro.");

  const seedTeams = teamList.map((t, i) => ({ teamId: t.id, teamName: t.name, seed: i + 1 }));
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, null, rounds);
}

/**
 * Arma el/los cuadro(s) de eliminatoria de una competencia, según su
 * `format_type`:
 * - `single_elimination` / `groups_only`: un único cuadro con los
 *   clasificados de cada grupo (`qualifiers_per_group`). Para
 *   `single_elimination` se dispara solo al completarse la fase de grupos
 *   (ver lib/advance-competition-phase.ts); para `groups_only` es siempre
 *   manual, vía el botón "Generar fase final" — este torneo no lo esperaba
 *   originalmente, así que nunca se dispara solo.
 * - `gold_silver`: dos cuadros — copa oro con los clasificados, copa plata
 *   con el resto de cada grupo (si un grupo no tiene sobrantes, la plata
 *   simplemente no se genera). Los partidos programables de ambos se
 *   agendan en una sola pasada de cancha/turno para no chocarse entre sí.
 * - `bracket_only`: un cuadro directo por siembra manual, sin fase de
 *   grupos.
 *
 * Es idempotente por `bracket_type`: si se vuelve a invocar, solo genera lo
 * que todavía no existe (ej. oro ya armado, plata pendiente).
 */
export async function generateBracketForCompetition(supabase: SupabaseClient, competitionId: string): Promise<void> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");

  if (competition.format_type === "bracket_only") {
    await generateBracketOnlyBracket(supabase, competitionId);
  } else if (competition.format_type === "gold_silver") {
    await generateGroupBracket(supabase, competitionId, "gold", (s) => s.slice(0, competition.qualifiers_per_group));
    await generateGroupBracket(supabase, competitionId, "silver", (s) => s.slice(competition.qualifiers_per_group));
  } else if (competition.format_type === "single_elimination" || competition.format_type === "groups_only") {
    await generateGroupBracket(supabase, competitionId, null, (s) => s.slice(0, competition.qualifiers_per_group));
  } else {
    throw new Error("Esta competencia no tiene un formato con cuadro de eliminación.");
  }

  // Asignación automática de cancha + turno para los partidos que sí se van
  // a jugar (los "bye" de la ronda 1 ya quedaron completed, sin partido real
  // que jugar). Una sola pasada sobre TODOS los partidos de cuadro
  // pendientes de la competencia — así oro y plata (o un reintento parcial)
  // no se pisan el turno entre sí.
  const { data: bracketMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("competition_id", competitionId)
    .eq("phase", "bracket")
    .neq("status", "completed");

  if ((bracketMatches ?? []).length > 0) {
    await autoScheduleAndPersist(
      supabase,
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
    await supabase.from("competitions").update({ status: "bracket_in_progress" }).eq("id", competitionId);
  }
}
