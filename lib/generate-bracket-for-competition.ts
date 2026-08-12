import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeedOrder, generateBracketRounds } from "./bracket";
import { persistBracket } from "./bracket-actions";
import type { Competition, GroupStandingRow } from "./database.types";

/**
 * Arma el cuadro de eliminatoria simple de una competencia a partir de la
 * tabla de posiciones de sus grupos (clasificados = qualifiers_per_group por
 * grupo). Reusada tanto por el botón manual del admin como por el avance
 * automático de fase (ver advance-competition-phase.ts). Es idempotente en
 * el sentido de que el llamador debe chequear que no exista bracket previo
 * antes de invocarla (ambos call sites lo hacen).
 */
export async function generateBracketForCompetition(
  supabase: SupabaseClient,
  competitionId: string
): Promise<void> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");
  if (competition.format_type !== "single_elimination") {
    throw new Error("Esta competencia no tiene eliminatoria simple configurada.");
  }

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
    const rows = (standings ?? []) as GroupStandingRow[];
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.slice(0, competition.qualifiers_per_group).map((r, i) => ({
        teamId: r.team_id,
        teamName: r.team_name,
        rank: i + 1,
      })),
    });
  }

  const seedTeams = buildSeedOrder(qualifiersByGroup);
  if (seedTeams.length < 2) {
    throw new Error("No hay suficientes equipos clasificados para armar un cuadro.");
  }

  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, null, rounds);

  await supabase.from("competitions").update({ status: "bracket_in_progress" }).eq("id", competitionId);
}
