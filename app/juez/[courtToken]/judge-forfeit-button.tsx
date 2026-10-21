"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ForfeitSide } from "@/lib/database.types";

/** "Un equipo no se presentó" en la pantalla del juez, antes de arrancar el
 * partido (W.O.). Elegir quién faltó → cartel que dice qué queda → guardar.
 * Reglas en lib/forfeit-rules.ts. */
export function JudgeForfeitButton({
  courtToken,
  matchId,
  teamAName,
  teamBName,
  woScore,
  knockout,
}: {
  courtToken: string;
  matchId: string;
  teamAName: string;
  teamBName: string;
  woScore: number;
  knockout: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<ForfeitSide | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!side) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/forfeit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtToken, side }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo cargar el W.O.");
        setSending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-sm panel-label underline py-1">
        Un equipo no se presentó
      </button>
    );
  }

  const effect =
    side === "a"
      ? `Gana ${teamBName} por W.O. (0–${woScore}).`
      : side === "b"
        ? `Gana ${teamAName} por W.O. (${woScore}–0).`
        : side === "both"
          ? knockout
            ? "Nadie avanza desde este cruce."
            : "Queda 0–0 y ninguno suma puntos."
          : null;

  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 space-y-2.5 panel-enter">
      <p className="text-sm font-medium">¿Quién no se presentó?</p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { s: "a", label: teamAName },
            { s: "b", label: teamBName },
            { s: "both", label: "Ninguno" },
          ] as { s: ForfeitSide; label: string }[]
        ).map((o) => (
          <button
            key={o.s}
            onClick={() => setSide(o.s)}
            disabled={sending}
            className={`rounded-lg py-2.5 text-sm font-medium border transition active:scale-[0.97] ${
              side === o.s ? "bg-brand-teal text-white border-brand-teal" : "border-neutral-300 bg-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {effect && <p className="text-sm font-semibold text-brand-orange">{effect}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={!side || sending}
          className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-2.5 text-sm disabled:opacity-40"
        >
          {sending ? "Guardando…" : "Sí, cargar W.O."}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setSide(null);
          }}
          disabled={sending}
          className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-2.5 text-sm"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
