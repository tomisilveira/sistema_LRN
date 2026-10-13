"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseTeamInput, parseMentorInput, isFutbolCompetition } from "@/lib/team-input";
import { clientIp, takeRateLimit } from "@/lib/rate-limit";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

export type RegisterTeamResult = { ok: true } | { ok: false; error: string };

// 30 inscripciones cada 10 minutos por IP: un profe con muchos equipos
// desde la escuela entra holgado; un script que manda cientos, no.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Server Action pública (sin sesión): la usa el formulario de auto-registro
// de equipos. No hay usuario autenticado acá, así que escribe con la
// service-role key, pero re-valida "¿está abierta la inscripción?" a mano
// antes de insertar nada — el mismo patrón que el endpoint del juez.
//
// Devuelve el error en vez de tirarlo: en producción Next oculta el texto
// de los errores tirados por una Server Action (muestra uno genérico en
// inglés), y acá el mensaje es para la familia que se está inscribiendo.
export async function registerTeam(competitionId: string, formData: FormData): Promise<RegisterTeamResult> {
  try {
    // Campo trampa completado → robot. Se le responde "ok" para que no
    // insista, pero no se guarda nada.
    if (String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "") return { ok: true };

    if (!takeRateLimit(`inscripcion:${await clientIp()}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return {
        ok: false,
        error: "Se mandaron demasiadas inscripciones seguidas desde esta conexión. Esperá unos minutos y probá de nuevo.",
      };
    }

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
      return { ok: false, error: "Las inscripciones para este torneo están cerradas." };
    }

    const acceptedTerms = formData.get("accepted_terms") === "on";
    if (!acceptedTerms) {
      return { ok: false, error: "Tenés que leer y aceptar las bases y condiciones para inscribirte." };
    }

    // Mismo parseo del responsable adulto que usan la mesa de acreditación y
    // el "+ Agregar equipo" del admin — acá es obligatorio.
    const { mentorName, mentorContact } = parseMentorInput(formData);
    if (!mentorName) return { ok: false, error: "Cargá los datos del mentor/profesor responsable." };

    const isFutbol = await isFutbolCompetition(supabase, competitionId);
    // parseTeamInput valida nombre, 1..4 integrantes, los 2 robots de fútbol y
    // (acá, obligatorias) provincia y localidad. Tira Error con un texto
    // pensado para mostrar.
    const input = parseTeamInput(formData, { isFutbol, requireLocation: true });

    const { error } = await supabase.from("teams").insert({
      competition_id: competitionId,
      name: input.name,
      institution: input.institution,
      province: input.province,
      locality: input.locality,
      mentor_name: mentorName,
      mentor_contact: mentorContact,
      member_count: input.memberCount,
      member_names: input.memberNames,
      robot_names: input.robotNames,
      accepted_terms_at: new Date().toISOString(),
      notes: input.notes,
    });
    if (error) {
      console.error("registerTeam: insert falló", error);
      return { ok: false, error: "No se pudo guardar la inscripción. Probá de nuevo en un momento." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar el equipo." };
  }
}
