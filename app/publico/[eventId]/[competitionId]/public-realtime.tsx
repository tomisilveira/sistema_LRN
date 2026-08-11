"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla pública apenas se carga un resultado nuevo, sin recargar la página a mano. */
export function PublicRealtime({ competitionId }: { competitionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`public-matches-${competitionId}`)
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
