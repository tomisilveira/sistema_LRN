import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { joinNameList, parseMemberNames } from "./team-display";
import { MAX_TEAM_MEMBERS } from "./team-limits";

export { MAX_TEAM_MEMBERS };

export interface ParsedTeamInput {
  name: string;
  institution: string | null;
  memberNames: string | null;
  /** Derivado de la lista de integrantes — ya no se pide a mano. */
  memberCount: number;
  robotNames: string | null;
  notes: string | null;
}

/**
 * Parseo + validación compartidos entre TODAS las vías de alta/edición de
 * equipos: inscripción pública, "+ Agregar/Editar equipo" del admin y la
 * mesa de acreditación. Tira errores en español, listos para mostrar.
 *
 * Reglas:
 * - nombre obligatorio,
 * - entre 1 y MAX_TEAM_MEMBERS integrantes (la cantidad sale de la lista,
 *   no de un campo aparte),
 * - fútbol robótico: 2 robots titulares obligatorios (el suplente es
 *   opcional).
 */
export function parseTeamInput(formData: FormData, opts: { isFutbol: boolean }): ParsedTeamInput {
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const memberNamesRaw = String(formData.get("member_names") ?? "").trim() || null;
  const robot1 = String(formData.get("robot_1") ?? "").trim();
  const robot2 = String(formData.get("robot_2") ?? "").trim();
  const robot3 = String(formData.get("robot_3") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Falta el nombre del equipo.");

  const members = parseMemberNames(memberNamesRaw);
  if (members.length < 1) {
    throw new Error("Cargá al menos un integrante del equipo — la lista se usa para la premiación.");
  }
  if (members.length > MAX_TEAM_MEMBERS) {
    throw new Error(
      `Máximo ${MAX_TEAM_MEMBERS} integrantes por equipo (cargaste ${members.length}). Quitá los que sobren.`
    );
  }

  if (opts.isFutbol && (!robot1 || !robot2)) {
    throw new Error("Fútbol robótico se juega con 2 robots. Cargá los dos (el suplente es opcional).");
  }

  return {
    name,
    institution,
    memberNames: memberNamesRaw,
    memberCount: members.length,
    robotNames: joinNameList([robot1, robot2, robot3]),
    notes,
  };
}

/** ¿La competencia es de fútbol robótico? (la única disciplina que arma el
 * equipo con más de un robot). Se usa para decidir si `parseTeamInput`
 * exige los 2 robots. */
export async function isFutbolCompetition(
  supabase: SupabaseClient,
  competitionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("competitions")
    .select("disciplines(slug)")
    .eq("id", competitionId)
    .maybeSingle<{ disciplines: { slug: string } | null }>();
  return data?.disciplines?.slug === "futbol";
}
