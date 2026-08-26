"use client";

import { useState } from "react";

/** Botón submit que pide confirmación antes de dejar pasar el envío del
 * formulario — para acciones destructivas (borran o pisan datos) donde un
 * click de más en medio de una jornada puede costar caro.
 *
 * El cartel de confirmación es propio del sistema (no `window.confirm`) —
 * en un navegador de celular/tablet ese diálogo nativo se puede bloquear o
 * directamente no aparecer, reportado en vivo 2026-08-27 sobre "Mover a
 * otro torneo" y aplicado acá al mismo patrón por ser el mismo riesgo:
 * esta única pieza la usan ~12 botones destructivos de todo el panel
 * (Eliminar torneo/evento/equipo/cancha, Reiniciar torneo/cuadro, Sortear
 * equipos), así que arreglarla acá los cubre a todos de una. */
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className={className} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1.5 rounded-md border border-red-500/30 bg-red-500/8 p-2 text-xs max-w-[240px] panel-enter">
      <span className="panel-label">{confirmMessage}</span>
      <span className="flex gap-1.5">
        <button type="submit" className="flex-1 rounded panel-button-danger py-1.5 font-medium">
          Sí, confirmar
        </button>
        <button type="button" onClick={() => setArmed(false)} className="flex-1 rounded panel-button-secondary py-1.5">
          Cancelar
        </button>
      </span>
    </span>
  );
}
