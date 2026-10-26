"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Cada cuánto se refresca una página pública abierta. Las páginas públicas
 * se rearman en el server como mucho cada 5 s para todos (ISR, ver
 * app/page.tsx), así que refrescar más seguido no trae nada nuevo. */
const POLL_MS = 10_000;

/** Mantiene al día una página pública (inicio, /publico, pantalla, próximos,
 * locutor) refrescándola cada ~10 s mientras la pestaña está visible, y
 * apenas vuelve a primer plano (TV o celular que se durmió).
 *
 * Antes (hasta oct 2026) cada página abría un canal de Supabase Realtime y
 * refrescaba con cada cambio de CUALQUIER partido: con 300 celulares eso
 * eran 300 conexiones en vivo (el plan tiene tope de ~200–500) y una
 * avalancha de páginas armadas de cero que tiró la base en la prueba de
 * carga, frenando también a los jueces. Ahora el público pide la página ya
 * armada y la base no se entera de cuánta gente mira. Realtime queda para
 * jueces y admin (lib/use-realtime-refresh.ts). */
export function PublicRealtime() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Arranque desfasado al azar: si todos los celulares entran juntos (ej.
    // cuando el locutor lee el QR), no refrescan todos en el mismo segundo.
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
      schedule(POLL_MS);
    };
    schedule(POLL_MS * (0.5 + Math.random()));

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        schedule(POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
