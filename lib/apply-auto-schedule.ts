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

/** Graba cancha + turno de varios partidos. PostgREST no tiene un UPDATE
 * con un valor distinto por fila, así que va un pedido por partido, pero de
 * a tandas en paralelo: 30 partidos son ~2 viajes en vez de 30 seguidos.
 * `onlyStatuses`: no tocar el partido si mientras tanto cambió de estado
 * (ej. el juez lo arrancó). */
export async function persistCourtAssignments(
  supabase: SupabaseClient,
  assignments: { matchId: string; courtId: string; turno: number }[],
  onlyStatuses?: string[]
): Promise<void> {
  const BATCH = 25;
  for (let i = 0; i < assignments.length; i += BATCH) {
    const results = await Promise.all(
      assignments.slice(i, i + BATCH).map((a) => {
        const q = supabase.from("matches").update({ court_id: a.courtId, turno: a.turno }).eq("id", a.matchId);
        return onlyStatuses ? q.in("status", onlyStatuses) : q;
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
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
  await persistCourtAssignments(supabase, autoScheduleMatches(matches, courts));
}
