"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateEncuestaTokens } from "./actions";

/** "Generar links": crea el token de los equipos del evento que todavía no
 * tienen. Idempotente (los existentes no cambian). */
export function GenerateLinksButton({ eventId, missing }: { eventId: string; missing: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  if (missing <= 0 && !msg) return null;

  return (
    <>
      {missing > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await generateEncuestaTokens(eventId);
              setMsg(r.ok ? `Listo: ${r.created} links nuevos.` : r.error);
              router.refresh();
            })
          }
          className="rounded-md panel-button-primary font-medium px-3 py-2 disabled:opacity-60"
        >
          {pending ? "Generando…" : `Generar ${missing} link${missing === 1 ? "" : "s"}`}
        </button>
      )}
      {msg && <span className="panel-label" role="status">{msg}</span>}
    </>
  );
}
