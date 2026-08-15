import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { PublicEventBody } from "@/app/components/public-event-body";

export const revalidate = 0;

// Ver comentario equivalente en app/page.tsx: `anon` solo tiene grant de
// columnas puntuales sobre `events`, "*" rompe con permission denied.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

/** Deep-link a un torneo puntual (ej. un QR pegado en la cancha) — muestra
 * el mismo cuerpo que /publico/[eventId] (switcher de jornadas + switcher
 * de disciplinas), pero arrancando en esta competencia en vez de la
 * primera/en vivo. Antes esto era una página aparte con su propio "← volver"
 * y sin forma de saltar a otro torneo del evento ni a otra jornada. */
export default async function PublicCompetitionPage({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .maybeSingle<Competition>();
  if (!competition || competition.event_id !== eventId) notFound();

  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event || !event.is_public) notFound();

  const [{ data: competitions }, { data: switcherEventsRaw }] = await Promise.all([
    supabase
      .from("competitions")
      .select("*, disciplines(name, sort_order), categories(name)")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase
      .from("events")
      .select(EVENT_PUBLIC_COLUMNS)
      .eq("is_public", true)
      .neq("status", "finished")
      .order("event_date", { ascending: true }),
  ]);

  const switcherEvents = (switcherEventsRaw ?? []) as EventRow[];
  if (!switcherEvents.some((e) => e.id === event.id)) {
    switcherEvents.push(event);
    switcherEvents.sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
  }

  return (
    <PublicEventBody
      supabase={supabase}
      event={event}
      competitions={(competitions ?? []) as CompetitionWithNames[]}
      switcherEvents={switcherEvents}
      defaultCompetitionId={competitionId}
    />
  );
}
