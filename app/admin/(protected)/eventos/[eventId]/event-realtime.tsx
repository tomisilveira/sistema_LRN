"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/** Mantiene al día el Resumen del evento (partidos jugados, canchas en
 * vivo) mientras el admin lo tiene abierto. Sin filtro: Realtime no filtra
 * por lista de torneos, y el refresh ya viene debounceado con tope de espera
 * (ver lib/use-realtime-refresh.ts). */
export function EventRealtime({ eventId }: { eventId: string }) {
  useRealtimeRefresh({
    channelName: `admin-event-${eventId}`,
    debounceMs: 1500,
    maxWaitMs: 4000,
    fallbackPollMs: 60000,
  });
  return null;
}
