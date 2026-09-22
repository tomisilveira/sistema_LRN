"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/**
 * Se subscribe a cambios en `matches` de esta competencia (ej. un juez carga
 * un resultado desde su cancha) y refresca los datos server-rendered de la
 * página sin que el admin tenga que recargar manualmente.
 *
 * Debounceado con tope de espera, reconexión y red de seguridad — ver
 * lib/use-realtime-refresh.ts.
 */
export function RealtimeRefresh({ competitionId }: { competitionId: string }) {
  useRealtimeRefresh({
    channelName: `admin-matches-${competitionId}`,
    filter: `competition_id=eq.${competitionId}`,
    debounceMs: 1200,
    maxWaitMs: 3000,
    fallbackPollMs: 60000,
  });
  return null;
}
