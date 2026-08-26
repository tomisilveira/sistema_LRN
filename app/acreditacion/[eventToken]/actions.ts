"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinNameList } from "@/lib/team-display";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server Actions públicas (sin sesión): las usa la mesa de acreditación del
// evento. No hay usuario autenticado acá, así que escriben con la
// service-role key, pero validan a mano que el link (accreditation_token)
// sea real y que el equipo pertenezca a ESE evento antes de tocar nada —
// mismo patrón que app/inscripcion/[competitionId]/actions.ts y el token de
// cancha del juez (lib/judge-auth.ts).
async function assertTeamBelongsToEvent(supabase: SupabaseClient, eventToken: string, teamId: string) {
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("accreditation_token", eventToken)
    .maybeSingle();
  if (!event) throw new Error("Link de acreditación inválido.");

  const { data: team } = await supabase
    .from("teams")
    .select("id, competitions!inner(event_id)")
    .eq("id", teamId)
    .maybeSingle<{ id: string; competitions: { event_id: string } }>();
  if (!team || team.competitions.event_id !== event.id) {
    throw new Error("Ese equipo no pertenece a este evento.");
  }
}

export async function setAccredited(eventToken: string, teamId: string, value: boolean) {
  const supabase = createAdminClient();
  await assertTeamBelongsToEvent(supabase, eventToken, teamId);

  const { error } = await supabase
    .from("teams")
    .update({ accredited: value, accredited_at: value ? new Date().toISOString() : null })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/acreditacion/${eventToken}`);
}

export async function setHomologated(eventToken: string, teamId: string, value: boolean) {
  const supabase = createAdminClient();
  await assertTeamBelongsToEvent(supabase, eventToken, teamId);

  const { error } = await supabase
    .from("teams")
    .update({ homologated: value, homologated_at: value ? new Date().toISOString() : null })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/acreditacion/${eventToken}`);
}

export async function setParticipantsPresent(eventToken: string, teamId: string, formData: FormData) {
  const supabase = createAdminClient();
  await assertTeamBelongsToEvent(supabase, eventToken, teamId);

  const raw = String(formData.get("participants_present") ?? "").trim();
  const value = raw === "" ? null : Math.max(0, Number(raw));

  const { error } = await supabase.from("teams").update({ participants_present: value }).eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/acreditacion/${eventToken}`);
}

/** Corregir datos del equipo (nombre mal escrito, robots, institución,
 * integrantes, notas) desde la propia mesa de acreditación — para no
 * depender de que alguien entre al panel admin en medio de la fila de
 * gente esperando. Mismos campos que "Editar equipo" del admin
 * (ver TeamFormFields). */
export async function updateTeam(eventToken: string, teamId: string, formData: FormData) {
  const supabase = createAdminClient();
  await assertTeamBelongsToEvent(supabase, eventToken, teamId);

  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const memberCountRaw = String(formData.get("member_count") ?? "").trim();
  const memberNames = String(formData.get("member_names") ?? "").trim() || null;
  const robotNames = joinNameList([
    formData.get("robot_1") as string | null,
    formData.get("robot_2") as string | null,
    formData.get("robot_3") as string | null,
  ]);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) throw new Error("Falta el nombre del equipo.");

  const { error } = await supabase
    .from("teams")
    .update({
      name,
      institution,
      member_count: memberCountRaw ? Number(memberCountRaw) : null,
      member_names: memberNames,
      robot_names: robotNames,
      notes,
    })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/acreditacion/${eventToken}`);
}

/** Mover el equipo a otro torneo del mismo evento (se anotó en la
 * disciplina/categoría que no era) — mismas reglas que
 * moveTeamToCompetition del admin (competencias/[competitionId]/actions.ts):
 * solo si el equipo todavía no tiene partidos generados acá, y el destino
 * sigue en "setup". Sale del grupo que tenía; llega sin grupo al nuevo (lo
 * asigna el admin desde el panel). */
export async function moveTeamToCompetition(eventToken: string, teamId: string, targetCompetitionId: string) {
  if (!targetCompetitionId) return;

  const supabase = createAdminClient();
  await assertTeamBelongsToEvent(supabase, eventToken, teamId);

  const { data: team } = await supabase.from("teams").select("id, competition_id").eq("id", teamId).single();
  if (!team) throw new Error("Equipo no encontrado.");
  const competitionId = team.competition_id;

  const { count: matchesHere } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
  if (matchesHere) {
    throw new Error("Este equipo ya tiene partidos generados en su torneo actual — pedile a la organización que lo reinicie antes de moverlo.");
  }

  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("competitions").select("event_id").eq("id", competitionId).single(),
    supabase.from("competitions").select("id, event_id, status").eq("id", targetCompetitionId).maybeSingle(),
  ]);
  if (!target) throw new Error("Torneo de destino no encontrado.");
  if (!source || source.event_id !== target.event_id) {
    throw new Error("Solo se puede mover a otro torneo del mismo evento.");
  }
  if (target.status !== "setup") {
    throw new Error("El torneo de destino ya arrancó — pedile a la organización que lo reinicie antes de mover equipos ahí.");
  }

  const { data: groupIds } = await supabase.from("groups").select("id").eq("competition_id", competitionId);
  const ids = (groupIds ?? []).map((g) => g.id);
  if (ids.length > 0) {
    await supabase.from("group_teams").delete().eq("team_id", teamId).in("group_id", ids);
  }

  const { error } = await supabase
    .from("teams")
    .update({ competition_id: targetCompetitionId, seed_order: null })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath(`/acreditacion/${eventToken}`);
}
