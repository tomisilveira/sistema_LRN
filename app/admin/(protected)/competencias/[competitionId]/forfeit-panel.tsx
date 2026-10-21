"use client";

import { useState, useTransition } from "react";
import type { ForfeitSide } from "@/lib/database.types";
import type { MatchActionResult } from "./actions";

/** "No se presentó…" (W.O.) de un partido: elegir quién faltó y confirmar.
 * El texto de confirmación dice el resultado que queda (ver
 * lib/forfeit-rules.ts). Cartel propio, nunca `window.confirm`. */
export function ForfeitPanel({
  teamAName,
  teamBName,
  woScore,
  knockout,
  onForfeit,
  onDone,
}: {
  teamAName: string;
  teamBName: string;
  /** Goles/rounds que se le dan al presente (fútbol 3, sumo 2). */
  woScore: number;
  knockout: boolean;
  onForfeit: (side: ForfeitSide) => Promise<MatchActionResult>;
  onDone?: () => void;
}) {
  const [side, setSide] = useState<ForfeitSide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options: { side: ForfeitSide; label: string }[] = [
    { side: "a", label: teamAName },
    { side: "b", label: teamBName },
    { side: "both", label: "Ninguno" },
  ];

  const effect =
    side === "a"
      ? `Gana ${teamBName} por W.O. (${0}–${woScore}).`
      : side === "b"
        ? `Gana ${teamAName} por W.O. (${woScore}–0).`
        : side === "both"
          ? knockout
            ? "Nadie avanza desde este cruce: el rival de la ronda siguiente pasa directo."
            : "Queda 0–0 y ninguno de los dos suma puntos."
          : null;

  function confirm() {
    if (!side) return;
    setError(null);
    startTransition(async () => {
      const res = await onForfeit(side);
      if (!res.ok) {
        setError(res.error ?? "No se pudo cargar el W.O.");
        return;
      }
      setSide(null);
      onDone?.();
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-neutral-300 bg-neutral-50 p-2.5 text-xs max-w-md panel-enter">
      <p className="font-medium text-[13px]">¿Quién no se presentó?</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.side}
            type="button"
            onClick={() => setSide(o.side)}
            disabled={pending}
            className={`rounded px-2.5 py-1.5 font-medium ${
              side === o.side ? "panel-button-primary" : "panel-button-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {effect && (
        <div className="flex flex-col gap-1.5 rounded border border-brand-orange/40 bg-brand-orange/8 p-2">
          <span className="text-[13px]">{effect}</span>
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="rounded panel-button-primary px-3 py-1.5 font-medium disabled:opacity-50"
            >
              {pending ? "…" : "Sí, cargar W.O."}
            </button>
            <button
              type="button"
              onClick={() => setSide(null)}
              disabled={pending}
              className="rounded panel-button-secondary px-3 py-1.5"
            >
              Volver
            </button>
          </span>
        </div>
      )}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

/** Botón "🚫 No se presentó" que abre el panel — para la tarjeta angosta
 * del cuadro (server component). */
export function ForfeitToggle(props: Omit<Parameters<typeof ForfeitPanel>[0], "onDone">) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="space-y-1">
      <ForfeitPanel {...props} onDone={() => setOpen(false)} />
      <button type="button" onClick={() => setOpen(false)} className="text-[11px] panel-label underline">
        Cancelar
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs rounded panel-button-secondary px-2 py-1 whitespace-nowrap"
    >
      🚫 No se presentó
    </button>
  );
}
