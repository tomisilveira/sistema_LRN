"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Se subscribe a cambios en `matches` de esta competencia (ej. un juez carga
 * un resultado desde su cancha) y refresca los datos server-rendered de la
 * página sin que el admin tenga que recargar manualmente.
 */
export function RealtimeRefresh({ competitionId }: { competitionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-matches-${competitionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `competition_id=eq.${competitionId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [competitionId, router]);

  return null;
}
