"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/admin-auth";
import { newEncuestaToken } from "@/lib/encuesta/token";

export type GenerateTokensResult = { ok: true; created: number; total: number } | { ok: false; error: string };

/** Genera el token de cada equipo del evento que todavía no tenga uno. Los
 * existentes no se tocan (los links que ya se mandaron siguen andando). Se
 * escribe con la sesión del admin: la RLS de 0024 solo deja crear tokens de
 * equipos de eventos que administra. */
export async function generateEncuestaTokens(eventId: string): Promise<GenerateTokensResult> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!(await canManageEvent(supabase, eventId))) return { ok: false, error: "No administrás este evento." };

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, competition:competitions!inner(event_id)")
      .eq("competition.event_id", eventId);
    if (teamsError) return { ok: false, error: teamsError.message };
    const teamIds = (teams ?? []).map((t) => t.id as string);
    if (teamIds.length === 0) return { ok: true, created: 0, total: 0 };

    const { data: existing, error: exError } = await supabase.from("encuesta_tokens").select("team_id").in("team_id", teamIds);
    if (exError) return { ok: false, error: exError.message };
    const has = new Set((existing ?? []).map((e) => e.team_id as string));
    const missing = teamIds.filter((id) => !has.has(id));

    if (missing.length) {
      const { error } = await supabase
        .from("encuesta_tokens")
        .insert(missing.map((team_id) => ({ team_id, token: newEncuestaToken() })));
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/encuesta");
    return { ok: true, created: missing.length, total: teamIds.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron generar los links." };
  }
}
