import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoScheduleMatches, type SchedulableMatch } from "./auto-schedule";

/** Canchas utilizables para una competencia: primero las que ya están
 * etiquetadas con su disciplina; si no hay ninguna así, cualquier cancha
 * del evento (mejor asignar algo que no asignar nada). */
export async function getUsableCourts(
  supabase: SupabaseClient,
  eventId: string,
  disciplineId: string
): Promise<{ id: string }[]> {
  const { data: courts } = await supabase
    .from("courts")
    .select("id, discipline_id, sort_order")
    .eq("event_id", eventId)
    .order("sort_order");

  const list = courts ?? [];
  const matching = list.filter((c) => c.discipline_id === disciplineId);
  return (matching.length > 0 ? matching : list).map((c) => ({ id: c.id }));
}

/** Corre el auto-scheduler sobre una tanda de partidos recién creados y
 * graba cancha + turno en cada uno. No hace nada (deja los partidos sin
 * cancha) si el evento todavía no tiene canchas cargadas. */
export async function autoScheduleAndPersist(
  supabase: SupabaseClient,
  eventId: string,
  disciplineId: string,
  matches: SchedulableMatch[]
): Promise<void> {
  if (matches.length === 0) return;
  const courts = await getUsableCourts(supabase, eventId, disciplineId);
  const assignments = autoScheduleMatches(matches, courts);
  for (const a of assignments) {
    await supabase.from("matches").update({ court_id: a.courtId, turno: a.turno }).eq("id", a.matchId);
  }
}
