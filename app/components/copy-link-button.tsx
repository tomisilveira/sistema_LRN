"use client";

import { useState } from "react";

export function CopyLinkButton({ path, label = "Copiar link" }: { path: string; label?: string }) {
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
      className={`text-xs rounded-md px-2 py-1 whitespace-nowrap border transition-all duration-150 active:scale-[0.96] ${
        copied ? "panel-chip-success border-transparent" : "panel-button-secondary"
      }`}
    >
      {copied ? "✓ ¡Copiado!" : label}
    </button>
  );
}
