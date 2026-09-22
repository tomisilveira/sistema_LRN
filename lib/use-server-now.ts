"use client";

import { useEffect, useState } from "react";

// Desfase (ms) entre el reloj del servidor y el del dispositivo, compartido
// por todos los relojes de la página: se mide una sola vez contra
// /api/time y se vuelve a medir cuando la pestaña vuelve a primer plano
// (una TV/tablet que se durmió puede haber corregido su hora mientras).
//
// Por qué hace falta: `timer_running_since` lo escribe el servidor con SU
// hora. Si el dispositivo tiene la hora atrasada, `Date.now() - running_since`
// da negativo → se recorta a 0 → el reloj queda clavado en el tiempo
// completo ("se traba"); si la tiene adelantada, arranca con segundos de
// menos o directamente en 0:00.
let offsetMs = 0;
let syncPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function syncOffset(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("/api/time", { cache: "no-store" });
      const t1 = Date.now();
      if (!res.ok) return;
      const { now } = (await res.json()) as { now: number };
      // El servidor respondió, en promedio, a mitad del viaje de ida y vuelta.
      offsetMs = now - (t0 + t1) / 2;
      listeners.forEach((l) => l());
    } catch {
      // Sin red: seguimos con el último desfase conocido (o 0).
    } finally {
      // Deja volver a medir más adelante (vuelta a primer plano).
      setTimeout(() => (syncPromise = null), 5000);
    }
  })();
  return syncPromise;
}

/** Hora "del servidor" estimada en el cliente, re-renderizando cada
 * `tickMs`. Devuelve null en el primer render (server y primera pasada de
 * hidratación deben mostrar lo mismo — ver match-clock.tsx). El tick es
 * más corto que 1 s a propósito: con `setInterval(1000)` desfasado del
 * cambio de segundo, el display a veces repite o saltea un segundo, que en
 * la pantalla se ve como el reloj "trabándose". */
export function useServerNow(tickMs = 250): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now() + offsetMs);
    // Recién acá es seguro leer el reloj real (solo cliente, ya hidratado).
    update();
    listeners.add(update);
    void syncOffset();
    const id = setInterval(update, tickMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        update();
        void syncOffset();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      listeners.delete(update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tickMs]);

  return now;
}
