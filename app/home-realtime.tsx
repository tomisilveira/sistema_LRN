"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca el inicio apenas se carga un resultado nuevo en cualquier
 * torneo del evento activo — sin filtro por competencia porque Realtime no
 * soporta filtrar por una lista de ids, y el volumen de esta app es chico. */
export function HomeRealtime({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`home-matches-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  return null;
}
