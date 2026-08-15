import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { PublicEventBody } from "@/app/components/public-event-body";

export const revalidate = 0;

// Ver comentario equivalente en app/page.tsx: `anon` solo tiene grant de
// columnas puntuales sobre `events`, "*" rompe con permission denied.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

export default async function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  // No público (o no existe): 404 sin distinguir un caso del otro, para no
  // confirmarle a nadie que un id puntual corresponde a un evento oculto.
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

  // El evento que se está viendo puede estar finalizado (link viejo) — se
  // suma igual al switcher aunque el query de arriba lo excluya por estado,
  // para no perderlo de la fila de pastillas mientras se lo mira.
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
    />
  );
}
