"use client";

import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
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
      className="text-xs rounded-md border border-neutral-700 px-2 py-1 hover:bg-neutral-800 transition-colors whitespace-nowrap"
    >
      {copied ? "¡Copiado!" : "Copiar link de juez"}
    </button>
  );
}
