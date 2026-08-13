"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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
