"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/** Refresca la pantalla apenas se carga un resultado nuevo, sin recargar a
 * mano. Con `competitionId` se suscribe solo a esa competencia (página de
 * un torneo puntual); sin filtro, escucha toda la tabla `matches` — se usa
 * así en el inicio, que puede tener varios torneos del evento activo a la
 * vez y Realtime no soporta filtrar por una lista de ids.
 *
 * El refresh está debounceado (una ráfaga de UPDATEs = un solo refresh,
 * cada uno re-ejecuta toda la cascada de queries del server component) pero
 * con tope de espera, reconexión y red de seguridad — ver
 * lib/use-realtime-refresh.ts. */
export function PublicRealtime({ competitionId }: { competitionId?: string }) {
  useRealtimeRefresh({
    channelName: competitionId ? `public-matches-${competitionId}` : "public-matches-all",
    filter: competitionId ? `competition_id=eq.${competitionId}` : undefined,
    debounceMs: 1200,
    maxWaitMs: 3000,
    fallbackPollMs: 30000,
  });
  return null;
}
