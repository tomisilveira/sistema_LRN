"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla del juez si el admin reasigna/reordena el cronograma de su cancha. */
export function JudgeRealtime({ courtId }: { courtId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`judge-court-${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `court_id=eq.${courtId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId, router]);

  return null;
}
