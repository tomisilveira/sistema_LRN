"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseRunTime } from "@/lib/time-trial";
import type { Competition } from "@/lib/database.types";
import type { MatchActionResult } from "./actions";

// Acciones del panel para la contrarreloj (format_type 'time_trial',
// seguidor de línea). Corren con la sesión del admin: la RLS de
// time_trial_runs (0019) limita a quien administra el evento. Devuelven el
// error en vez de tirarlo (en producción Next oculta el mensaje).

function revalidate(competitionId: string) {
  revalidatePath(`/admin/competencias/${competitionId}`);
  revalidatePath(`/publico`);
}

async function guard(fn: () => Promise<void>, fallback: string): Promise<MatchActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : fallback };
  }
}

async function loadCompetition(competitionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .maybeSingle<Competition>();
  if (!competition) throw new Error("Torneo no encontrado.");
  if (competition.format_type !== "time_trial") throw new Error("Este torneo no es contrarreloj.");
  return { supabase, competition };
}

/** setup → en curso (los jueces ya pueden cargar tiempos); en curso →
 * terminado; terminado → en curso (reabrir para corregir o sumar). */
export async function setTimeTrialStatus(
  competitionId: string,
  next: "running" | "finished"
): Promise<MatchActionResult> {
  return guard(async () => {
    const { supabase, competition } = await loadCompetition(competitionId);
    if (next === "running" && (competition.status === "setup" || competition.status === "finished")) {
      const { count } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competitionId);
      if (!count) throw new Error("Cargá los robots antes de iniciar (pestaña Equipos).");
    }
    const { error } = await supabase
      .from("competitions")
      .update(
        next === "running"
          ? { status: "groups_in_progress", registration_open: false }
          : { status: "finished" }
      )
      .eq("id", competitionId);
    if (error) throw new Error(error.message);
    revalidate(competitionId);
  }, "No se pudo cambiar el estado del torneo.");
}

/** Carga o corrige un intento desde el panel. `attempt` existente → se
 * pisa; nuevo → se crea. Tiempo vacío + dnf = "no terminó". */
export async function saveTimeTrialRun(
  competitionId: string,
  teamId: string,
  attempt: number,
  formData: FormData
): Promise<MatchActionResult> {
  return guard(async () => {
    const { supabase, competition } = await loadCompetition(competitionId);
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > competition.periods_count) {
      throw new Error(`El intento tiene que ser entre 1 y ${competition.periods_count}.`);
    }
    const dnf = formData.get("dnf") === "on";
    let timeMs: number | null = null;
    if (!dnf) {
      timeMs = parseRunTime(String(formData.get("time") ?? ""));
      if (timeMs === null) throw new Error("Escribí el tiempo (ej. 12.34 o 1:05.20) o marcá que no terminó.");
      if (competition.period_seconds && timeMs > competition.period_seconds * 1000) timeMs = null;
    }

    const { data: team } = await supabase.from("teams").select("competition_id").eq("id", teamId).maybeSingle();
    if (!team || team.competition_id !== competitionId) throw new Error("El robot no es de este torneo.");

    const { error } = await supabase.from("time_trial_runs").upsert(
      {
        competition_id: competitionId,
        team_id: teamId,
        attempt,
        time_ms: timeMs,
        finished: timeMs !== null,
      },
      { onConflict: "team_id,attempt" }
    );
    if (error) throw new Error(error.message);
    revalidate(competitionId);
  }, "No se pudo guardar el intento.");
}

export async function deleteTimeTrialRun(competitionId: string, runId: string): Promise<MatchActionResult> {
  return guard(async () => {
    const { supabase } = await loadCompetition(competitionId);
    const { error } = await supabase
      .from("time_trial_runs")
      .delete()
      .eq("id", runId)
      .eq("competition_id", competitionId);
    if (error) throw new Error(error.message);
    revalidate(competitionId);
  }, "No se pudo borrar el intento.");
}
