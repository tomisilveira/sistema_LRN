"use client";

import { useEffect, useRef, useState } from "react";

/** Envuelve el marcador de una cancha en Modo Pantalla: guarda el score
 * anterior y, si subió (llegó un gol/punto nuevo vía realtime →
 * router.refresh()), dispara un flash breve (.goal-flash, ver globals.css)
 * más un cartel "¡GOL!" que se solo. No hace nada si el marcador bajó
 * (corrección del juez) o se mantuvo igual. */
export function GoalFlash({
  scoreA,
  scoreB,
  children,
}: {
  scoreA: number;
  scoreB: number;
  children: React.ReactNode;
}) {
  const prevRef = useRef({ a: scoreA, b: scoreB });
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const prev = prevRef.current;
    const increased = scoreA > prev.a || scoreB > prev.b;
    prevRef.current = { a: scoreA, b: scoreB };
    if (!increased) return;
    setCelebrating(true);
    const timeout = setTimeout(() => setCelebrating(false), 1500);
    return () => clearTimeout(timeout);
  }, [scoreA, scoreB]);

  return (
    <div className={`relative ${celebrating ? "goal-flash" : ""}`}>
      {children}
      {celebrating && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-green text-white text-xs font-display font-bold uppercase tracking-wide px-3 py-1 shadow-md panel-enter"
          aria-hidden="true"
        >
          ¡Gol!
        </span>
      )}
    </div>
  );
}
