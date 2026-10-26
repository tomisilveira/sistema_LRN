"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/** Mantiene al día el Resumen del evento (partidos jugados, canchas en
 * vivo) mientras el admin lo tiene abierto. Sin filtro: Realtime no filtra
 * por lista de torneos, y el refresh ya viene debounceado con tope de espera
 * (ver lib/use-realtime-refresh.ts). Tope de 10 s (antes 4): es una página
 * pesada y con varias canchas en vivo se rearmaba casi sin pausa por cada
 * admin con el Resumen abierto, cargando la base que comparten los jueces. */
export function EventRealtime({ eventId }: { eventId: string }) {
  useRealtimeRefresh({
    channelName: `admin-event-${eventId}`,
    debounceMs: 3000,
    maxWaitMs: 10000,
    fallbackPollMs: 60000,
  });
  return null;
}
