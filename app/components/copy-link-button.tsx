"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "./action-icons";

/** Copia al portapapeles sin depender de `navigator.clipboard`, que no
 * existe fuera de HTTPS/localhost (ej. el panel abierto por IP en la red
 * del evento). Nunca `window.prompt` — regla del proyecto, se bloquea en
 * celular/tablet. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function CopyLinkButton({
  path,
  label = "Copiar link",
  compact = false,
  variant = "pill",
}: {
  path: string;
  label?: string;
  /** Versión chica (px-2 py-1) para filas densas como la tarjeta de cancha. */
  compact?: boolean;
  /** 'toolbar': botón con ícono de la barra de acciones del evento
   * (.panel-action, ver globals.css). */
  variant?: "pill" | "toolbar";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    const ok = await copyText(`${window.location.origin}${path}`);
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), ok ? 1500 : 2500);
  }

  if (variant === "toolbar") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={`panel-action ${compact ? "panel-action-sm" : ""} ${state === "copied" ? "panel-action-done" : ""}`}
        aria-live="polite"
      >
        {state === "copied" ? <CheckIcon /> : <LinkIcon />}
        {state === "copied" ? "¡Copiado!" : state === "failed" ? "No se pudo copiar" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-xs rounded-full whitespace-nowrap border transition-all duration-150 active:scale-[0.96] ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      } ${state === "copied" ? "panel-chip-success border-transparent" : "panel-button-secondary"}`}
    >
      {state === "copied" ? "✓ ¡Copiado!" : state === "failed" ? "No se pudo copiar" : label}
    </button>
  );
}
