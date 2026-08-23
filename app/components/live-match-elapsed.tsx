"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Cronómetro chico de "hace cuánto está en curso", de solo lectura para el
 * público. */
export function LiveMatchElapsed({ startedAt }: { startedAt: string }) {
  // `now` arranca en null (no en Date.now()): el server renderiza en un
  // instante distinto al que hidrata el cliente, así que un now calculado
  // en el render inicial da un texto distinto entre los dos — React lo
  // marca como hydration mismatch. Server y primer render de cliente
  // muestran el mismo placeholder; recién en el efecto (solo cliente) se
  // pisa con el valor real.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Recién acá es seguro leer el reloj real (solo cliente, después de que
    // hidrató con el placeholder) — mismo patrón que theme-toggle.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span>0:00</span>;
  return <span>{formatElapsed(now - new Date(startedAt).getTime())}</span>;
}
