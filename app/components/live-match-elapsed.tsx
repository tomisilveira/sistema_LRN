"use client";

import { useServerNow } from "@/lib/use-server-now";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Cronómetro chico de "hace cuánto está en curso", de solo lectura para el
 * público. `now` es null en el primer render (evita hydration mismatch) y
 * es la hora del servidor estimada — `started_at` también la pone el
 * servidor, ver lib/use-server-now.ts. */
export function LiveMatchElapsed({ startedAt }: { startedAt: string }) {
  const now = useServerNow();
  if (now === null) return <span>0:00</span>;
  return <span>{formatElapsed(now - new Date(startedAt).getTime())}</span>;
}
