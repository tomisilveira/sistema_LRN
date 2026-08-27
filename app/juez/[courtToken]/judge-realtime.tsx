"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla del juez si el admin reasigna/reordena el cronograma
 * de su cancha. Debounceado corto: si llega una ráfaga de cambios se hace un
 * solo refresh, sin que se note demora en la mesa de cancha. */
const REFRESH_DEBOUNCE_MS = 700;

export function JudgeRealtime({ courtId }: { courtId: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`judge-court-${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `court_id=eq.${courtId}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [courtId, router]);

  return null;
}
