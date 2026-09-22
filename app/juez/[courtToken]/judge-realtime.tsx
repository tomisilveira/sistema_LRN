"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/** Refresca la pantalla del juez si el admin reasigna/reordena el cronograma
 * de su cancha. Debounceado corto (sin demora notable en la mesa de
 * cancha), con tope de espera, reconexión y red de seguridad — ver
 * lib/use-realtime-refresh.ts. */
export function JudgeRealtime({ courtId }: { courtId: string }) {
  useRealtimeRefresh({
    channelName: `judge-court-${courtId}`,
    filter: `court_id=eq.${courtId}`,
    debounceMs: 700,
    maxWaitMs: 2000,
    fallbackPollMs: 30000,
  });
  return null;
}
