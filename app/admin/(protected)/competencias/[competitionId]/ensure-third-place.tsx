"use client";

import { useEffect, useRef, useTransition } from "react";
import { ensureThirdPlaceMatchAction } from "./actions";

/** Cuadros generados antes de la migración 0014 no traen el partido por el
 * 3er puesto (que ahora es obligatorio). Cuando un admin abre un torneo así,
 * este componente lo crea solo —una sola vez— y revalida la página. No
 * muestra nada. Para cuadros nuevos `needed` siempre es false (el 3er puesto
 * ya viene armado). */
export function EnsureThirdPlace({ competitionId, needed }: { competitionId: string; needed: boolean }) {
  const ran = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!needed || ran.current) return;
    ran.current = true;
    startTransition(async () => {
      try {
        await ensureThirdPlaceMatchAction(competitionId);
      } catch {
        // best-effort: si falla (carrera con otra pestaña, etc.) se
        // reintenta en el próximo submit de resultado vía
        // maybeAdvanceCompetitionPhase.
      }
    });
  }, [competitionId, needed, startTransition]);

  return null;
}
