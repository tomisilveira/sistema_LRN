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
      className="text-xs rounded-md panel-button-secondary px-2 py-1 transition-colors whitespace-nowrap"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
