"use client";

import { useState } from "react";

export function CopyLinkButton({
  path,
  label = "Copiar link",
  compact = false,
}: {
  path: string;
  label?: string;
  /** Versión chica (px-2 py-1) para filas densas como la tarjeta de cancha
   * — por defecto usa el mismo tamaño de pill que el resto de los botones
   * de acción (px-3 py-1.5), para no ser el único distinto en una fila de
   * acciones del header. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs rounded-full whitespace-nowrap border transition-all duration-150 active:scale-[0.96] ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      } ${copied ? "panel-chip-success border-transparent" : "panel-button-secondary"}`}
    >
      {copied ? "✓ ¡Copiado!" : label}
    </button>
  );
}
