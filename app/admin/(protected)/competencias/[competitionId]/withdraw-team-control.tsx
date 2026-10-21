"use client";

import { useState, useTransition } from "react";
import { reinstateTeamAction, withdrawTeamAction } from "./actions";

/** Baja de un equipo (robot roto, no compite más) y su vuelta atrás —
 * ver lib/forfeit.ts. Cartel de confirmación propio que dice qué va a
 * pasar antes de hacerlo; nunca `window.confirm`. */
export function WithdrawTeamControl({
  competitionId,
  teamId,
  teamName,
  withdrawn,
  reason,
  pendingMatches,
}: {
  competitionId: string;
  teamId: string;
  teamName: string;
  withdrawn: boolean;
  reason: string | null;
  /** Partidos que le quedan sin jugar (se dan por perdidos). */
  pendingMatches: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "No se pudo completar.");
      else {
        setMessage(res.message ?? null);
        setOpen(false);
        setText("");
      }
    });
  }

  if (withdrawn) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs rounded-md bg-neutral-100 border border-neutral-300 px-2.5 py-1.5">
          <span className="font-bold uppercase tracking-wide text-neutral-600">Baja</span> — no compite más
          {reason ? `: ${reason}` : "."}
        </p>
        {open ? (
          <span className="inline-flex flex-col gap-1.5 rounded-md border border-brand-teal/40 bg-brand-teal/5 p-2 text-xs max-w-sm panel-enter">
            <span className="panel-label">
              {teamName} vuelve a competir. Se reabren los partidos que perdió por W.O. automático (los de la
              llave, solo si nadie avanzó todavía por eso). ¿Reincorporar?
            </span>
            <span className="flex gap-1.5">
              <button
                type="button"
                onClick={() => run(() => reinstateTeamAction(competitionId, teamId))}
                disabled={pending}
                className="flex-1 rounded panel-button-primary py-1.5 font-medium disabled:opacity-50"
              >
                {pending ? "…" : "Sí, reincorporar"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded panel-button-secondary py-1.5">
                Cancelar
              </button>
            </span>
          </span>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="panel-action panel-action-sm">
            ↺ Reincorporar
          </button>
        )}
        {message && <p className="text-xs text-brand-green">{message}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {open ? (
        <div className="flex flex-col gap-2 rounded-md border border-red-500/30 bg-red-500/[0.05] p-2.5 text-xs max-w-sm panel-enter">
          <span className="font-medium text-[13px]">Dar de baja a {teamName} (robot roto)</span>
          <span className="panel-label">
            No compite más.{" "}
            {pendingMatches > 0
              ? `Sus ${pendingMatches} partido${pendingMatches === 1 ? "" : "s"} sin jugar se dan por perdidos (W.O.); contra otro equipo de baja quedan 0–0 sin puntos.`
              : "No le quedan partidos sin jugar."}{" "}
            En la llave, si su primer cruce todavía no empezó, entra el siguiente de su grupo. Lo ya jugado no
            se toca.
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Motivo (opcional), ej. se rompió un motor"
            className="rounded panel-input px-2 py-1.5 text-xs"
          />
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const fd = new FormData();
                fd.set("reason", text);
                run(() => withdrawTeamAction(competitionId, teamId, fd));
              }}
              disabled={pending}
              className="flex-1 rounded panel-button-danger py-1.5 font-medium disabled:opacity-50"
            >
              {pending ? "…" : "Sí, dar de baja"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded panel-button-secondary py-1.5">
              Cancelar
            </button>
          </span>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="panel-action panel-action-sm">
          🔧 Dar de baja (robot roto)
        </button>
      )}
      {message && <p className="text-xs text-brand-green">{message}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
