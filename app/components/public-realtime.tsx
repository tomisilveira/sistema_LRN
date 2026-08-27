"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla apenas se carga un resultado nuevo, sin recargar a
 * mano. Con `competitionId` se suscribe solo a esa competencia (página de
 * un torneo puntual); sin filtro, escucha toda la tabla `matches` — se usa
 * así en el inicio, que puede tener varios torneos del evento activo a la
 * vez y Realtime no soporta filtrar por una lista de ids.
 *
 * El refresh está debounceado: durante una jornada en vivo, un partido
 * genera una ráfaga de UPDATEs (marcador, reloj que corre/pausa, período)
 * y cada `router.refresh()` re-ejecuta toda la cascada de queries del
 * server component. Con el debounce, una ráfaga = un solo refresh. */
const REFRESH_DEBOUNCE_MS = 1200;

export function PublicRealtime({ competitionId }: { competitionId?: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channelName = competitionId ? `public-matches-${competitionId}` : "public-matches-all";

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          ...(competitionId ? { filter: `competition_id=eq.${competitionId}` } : {}),
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [competitionId, router]);

  return null;
}
