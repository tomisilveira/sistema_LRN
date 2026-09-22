"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeRefreshOptions {
  channelName: string;
  /** Filtro de Realtime (`columna=eq.valor`); sin filtro escucha toda la tabla. */
  filter?: string;
  /** Espera de silencio antes de refrescar — una ráfaga = un solo refresh. */
  debounceMs: number;
  /** Tope de espera desde el primer cambio pendiente. Sin esto, con varias
   * canchas en vivo llega un UPDATE cada menos de `debounceMs` y el
   * debounce se posterga para siempre: la pantalla queda congelada con el
   * estado viejo (reloj corriendo después de una pausa, o parado después de
   * reanudar). */
  maxWaitMs: number;
  /** Refresh de red de seguridad mientras la pestaña está visible, por si
   * se perdió algún evento (wifi que se corta, socket que se cae en
   * silencio). */
  fallbackPollMs: number;
}

/** Suscribe la página a cambios en `matches` y hace `router.refresh()`.
 * Además refresca al reconectarse el canal (lo que pasó mientras estaba
 * caído no llega como evento) y al volver la pestaña a primer plano (TV o
 * tablet que se durmió). */
export function useRealtimeRefresh({ channelName, filter, debounceMs, maxWaitMs, fallbackPollMs }: RealtimeRefreshOptions) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let firstPendingAt: number | null = null;
    let lastRefreshAt = Date.now();
    let hasSubscribedOnce = false;

    const refreshNow = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      firstPendingAt = null;
      lastRefreshAt = Date.now();
      router.refresh();
    };

    const scheduleRefresh = () => {
      const now = Date.now();
      firstPendingAt ??= now;
      if (debounceTimer) clearTimeout(debounceTimer);
      const wait = Math.max(0, Math.min(debounceMs, firstPendingAt + maxWaitMs - now));
      debounceTimer = setTimeout(refreshNow, wait);
    };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", ...(filter ? { filter } : {}) }, scheduleRefresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // La primera suscripción es la carga inicial (ya viene fresca del
          // server); las siguientes son reconexiones.
          if (hasSubscribedOnce) scheduleRefresh();
          hasSubscribedOnce = true;
        }
      });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt >= fallbackPollMs) refreshNow();
    }, Math.min(fallbackPollMs, 5000));

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [channelName, filter, debounceMs, maxWaitMs, fallbackPollMs, router]);
}
