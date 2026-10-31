"use client";

import { useEffect } from "react";

/** Para pantallas de TV: baja la página sola, despacio, y al llegar al final
 * espera un rato y vuelve arriba. Si todo entra en la pantalla no hace nada.
 * Si alguien scrollea a mano, retoma desde donde lo dejó. Usa setInterval
 * (no requestAnimationFrame) porque algunos navegadores de TV lo frenan. */
export function AutoScroll({ pxPerSecond = 40, pauseMs = 5000 }: { pxPerSecond?: number; pauseMs?: number }) {
  useEffect(() => {
    let last = performance.now();
    let pos = window.scrollY;
    let waitUntil = last + pauseMs;

    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // Scroll a mano (o cambio de alto por un refresco): seguir desde ahí.
      if (Math.abs(window.scrollY - pos) > 2) pos = window.scrollY;
      if (max <= 4 || now < waitUntil) return;

      if (pos >= max - 1) {
        pos = 0;
        // Salto directo: el "smooth" depende de animaciones que algunos
        // navegadores de TV frenan y quedaría trabado abajo.
        window.scrollTo(0, 0);
        waitUntil = now + pauseMs;
      } else {
        pos = Math.min(max, pos + pxPerSecond * dt);
        window.scrollTo(0, pos);
        if (pos >= max - 1) waitUntil = now + pauseMs;
      }
    }, 30);
    return () => window.clearInterval(id);
  }, [pxPerSecond, pauseMs]);

  return null;
}
