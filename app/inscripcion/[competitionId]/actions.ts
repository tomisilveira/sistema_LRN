"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { joinNameList } from "@/lib/team-display";

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
  const mentorPhone = String(formData.get("mentor_phone") ?? "").trim();
  const mentorEmail = String(formData.get("mentor_email") ?? "").trim();
  const memberCountRaw = String(formData.get("member_count") ?? "").trim();
  const memberNames = String(formData.get("member_names") ?? "").trim() || null;
  // Fútbol robótico se arma con 2 robots titulares + 1 suplente opcional
  // (ver registration-form.tsx, solo se muestran estos 3 campos si la
  // disciplina es fútbol) — el resto de las disciplinas no manda nada acá
  // y robotNames queda null.
  const robotNames = joinNameList([
    formData.get("robot_1") as string | null,
    formData.get("robot_2") as string | null,
    formData.get("robot_3") as string | null,
  ]);
  const acceptedTerms = formData.get("accepted_terms") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Falta el nombre del equipo.");
  if (!mentorName) throw new Error("Falta el nombre del mentor/profesor responsable.");
  if (!mentorPhone) throw new Error("Falta el celular del mentor.");
  if (!mentorEmail || !mentorEmail.includes("@")) throw new Error("Falta un email válido del mentor.");
  if (!acceptedTerms) throw new Error("Tenés que leer y aceptar las bases y condiciones para inscribirte.");

  // Sin columnas propias todavía para teléfono/email por separado — se
  // combinan acá en `mentor_contact` (mismo criterio "texto libre, solo
  // para mostrar" que member_names/robot_names), así no hace falta otra
  // migración para algo que en todo el sistema solo se muestra como una
  // línea de contacto, nunca se consulta por campo.
  const mentorContact = `${mentorPhone} · ${mentorEmail}`;

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    name,
    institution,
    mentor_name: mentorName,
    mentor_contact: mentorContact,
    member_count: memberCountRaw ? Number(memberCountRaw) : null,
    member_names: memberNames,
    robot_names: robotNames,
    accepted_terms_at: new Date().toISOString(),
    notes,
  });
  if (error) throw new Error(error.message);
}
