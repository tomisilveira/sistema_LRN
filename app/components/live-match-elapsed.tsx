"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Cronómetro chico de "hace cuánto está en curso" — mismo cálculo que el
 * timer del juez (app/juez/[courtToken]/match-timer.tsx), pero de solo
 * lectura para el público. */
export function LiveMatchElapsed({ startedAt }: { startedAt: string }) {
  // Mismo patrón que match-timer.tsx (juez): estado inicial perezoso en vez
  // de un setState síncrono dentro del efecto.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{formatElapsed(now - new Date(startedAt).getTime())}</span>;
}
