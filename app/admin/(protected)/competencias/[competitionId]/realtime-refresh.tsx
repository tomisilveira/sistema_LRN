"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Se subscribe a cambios en `matches` de esta competencia (ej. un juez carga
 * un resultado desde su cancha) y refresca los datos server-rendered de la
 * página sin que el admin tenga que recargar manualmente.
 *
 * El refresh está debounceado: un partido en curso emite una ráfaga de
 * UPDATEs (marcador en vivo, reloj, período) y cada `router.refresh()`
 * re-ejecuta toda la cascada de queries de la página del torneo. Con el
 * debounce, una ráfaga = un solo refresh.
 */
const REFRESH_DEBOUNCE_MS = 1200;

export function RealtimeRefresh({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`admin-matches-${competitionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `competition_id=eq.${competitionId}` },
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
