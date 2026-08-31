"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseTeamInput, isFutbolCompetition } from "@/lib/team-input";

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
  // Además del toggle manual, un torneo ya terminado no acepta equipos
  // nuevos. (La inscripción tardía SÍ está permitida mientras el torneo esté
  // en curso — el admin la reabre a mano y después usa "Armar partidos que
  // falten"; ver app/admin/(protected)/competencias/[competitionId]/actions.ts.)
  if (!competition?.registration_open || competition.status === "finished") {
    throw new Error("Las inscripciones para este torneo están cerradas.");
  }

  const mentorName = String(formData.get("mentor_name") ?? "").trim();
  const mentorPhone = String(formData.get("mentor_phone") ?? "").trim();
  const mentorEmail = String(formData.get("mentor_email") ?? "").trim();
  const acceptedTerms = formData.get("accepted_terms") === "on";

  if (!mentorName) throw new Error("Falta el nombre del mentor/profesor responsable.");
  if (!mentorPhone) throw new Error("Falta el celular del mentor.");
  if (!mentorEmail || !mentorEmail.includes("@")) throw new Error("Falta un email válido del mentor.");
  if (!acceptedTerms) throw new Error("Tenés que leer y aceptar las bases y condiciones para inscribirte.");

  const isFutbol = await isFutbolCompetition(supabase, competitionId);
  // parseTeamInput valida nombre, 1..4 integrantes y los 2 robots de fútbol.
  const input = parseTeamInput(formData, { isFutbol });

  // Sin columnas propias todavía para teléfono/email por separado — se
  // combinan acá en `mentor_contact` (mismo criterio "texto libre, solo
  // para mostrar" que member_names/robot_names).
  const mentorContact = `${mentorPhone} · ${mentorEmail}`;

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    name: input.name,
    institution: input.institution,
    mentor_name: mentorName,
    mentor_contact: mentorContact,
    member_count: input.memberCount,
    member_names: input.memberNames,
    robot_names: input.robotNames,
    accepted_terms_at: new Date().toISOString(),
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}
