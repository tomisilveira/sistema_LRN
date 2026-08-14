"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla apenas se carga un resultado nuevo, sin recargar a
 * mano. Con `competitionId` se suscribe solo a esa competencia (página de
 * un torneo puntual); sin filtro, escucha toda la tabla `matches` — se usa
 * así en el inicio, que puede tener varios torneos del evento activo a la
 * vez y Realtime no soporta filtrar por una lista de ids. */
export function PublicRealtime({ competitionId }: { competitionId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channelName = competitionId ? `public-matches-${competitionId}` : "public-matches-all";
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
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [competitionId, router]);

  return null;
}
