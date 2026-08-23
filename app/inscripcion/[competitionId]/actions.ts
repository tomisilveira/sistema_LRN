"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Server Action pública (sin sesión): la usa el formulario de auto-registro
// de equipos. No hay usuario autenticado acá, así que escribe con la
// service-role key, pero re-valida "¿está abierta la inscripción?" a mano
// antes de insertar nada — el mismo patrón que el endpoint del juez.
export async function registerTeam(competitionId: string, formData: FormData) {
  const supabase = createAdminClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("registration_open, status")
    .eq("id", competitionId)
    .maybeSingle();
  // Mismo criterio que la página (ver page.tsx): además del toggle manual,
  // una vez que el torneo arrancó ya no acepta equipos nuevos, aunque el
  // admin se haya olvidado de cerrar la inscripción a mano.
  if (!competition?.registration_open || competition.status !== "setup") {
    throw new Error("Las inscripciones para este torneo están cerradas.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const mentorName = String(formData.get("mentor_name") ?? "").trim();
  const mentorContact = String(formData.get("mentor_contact") ?? "").trim();
  const memberCountRaw = String(formData.get("member_count") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Falta el nombre del equipo.");
  if (!mentorName) throw new Error("Falta el nombre del mentor/profesor responsable.");
  if (!mentorContact) throw new Error("Falta un contacto (email o teléfono) del mentor.");

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    name,
    institution,
    mentor_name: mentorName,
    mentor_contact: mentorContact,
    member_count: memberCountRaw ? Number(memberCountRaw) : null,
    notes,
  });
  if (error) throw new Error(error.message);
}
