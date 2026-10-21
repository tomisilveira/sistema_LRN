"use client";

import { useState, useTransition } from "react";
import type { MatchActionResult } from "./actions";
import type { CourtOption } from "./match-row";
import { MatchResultForm } from "./match-result-form";
import { MatchScheduleForm } from "./match-schedule-form";
import { ForfeitPanel } from "./forfeit-panel";
import type { ForfeitSide } from "@/lib/database.types";

type Panel = "result" | "schedule" | "reset" | "forfeit" | null;

/** Barra de acciones de la tarjeta de un partido de grupo: cada botón abre
 * su formulario debajo (uno a la vez) en vez de tener todos los campos
 * siempre a la vista. Cartel de confirmación propio para reiniciar, nunca
 * `window.confirm` (se bloquea en celular/tablet). */
export function MatchRowActions({
  status,
  matchId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  scoreA,
  scoreB,
  allowDraws,
  courtId,
  turno,
  courts,
  competitionDisciplineId,
  disciplineNameById,
  onSchedule,
  onResult,
  onReset,
  onForfeit,
  woScore,
}: {
  status: "pending_teams" | "scheduled" | "in_progress" | "completed";
  matchId: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  scoreA: number | null;
  scoreB: number | null;
  allowDraws: boolean;
  courtId: string | null;
  turno: number | null;
  courts: CourtOption[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  onSchedule: (matchId: string, formData: FormData) => Promise<void>;
  onResult: (formData: FormData) => Promise<MatchActionResult>;
  onReset: () => Promise<MatchActionResult>;
  onForfeit: (side: ForfeitSide) => Promise<MatchActionResult>;
  /** Goles/rounds del W.O. (fútbol 3, sumo 2). */
  woScore: number;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const played = status === "completed";
  const canReset = played || status === "in_progress";

  function toggle(p: Exclude<Panel, null>) {
    setError(null);
    setPanel((cur) => (cur === p ? null : p));
  }

  function confirmReset() {
    startTransition(async () => {
      const res = await onReset();
      if (!res.ok) setError(res.error ?? "No se pudo reiniciar el partido.");
      setPanel(null);
    });
  }

  const tab = (p: Exclude<Panel, null>) =>
    `text-xs rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors ${
      panel === p ? "panel-button-primary" : "panel-button-secondary"
    }`;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => toggle("result")} className={tab("result")}>
          {played ? "✏️ Corregir resultado" : "📝 Cargar resultado"}
        </button>
        {!played && (
          <button type="button" onClick={() => toggle("schedule")} className={tab("schedule")}>
            🏟 Cancha/turno
          </button>
        )}
        {!played && (
          <button type="button" onClick={() => toggle("forfeit")} className={tab("forfeit")}>
            🚫 No se presentó
          </button>
        )}
        {canReset && (
          <button type="button" onClick={() => toggle("reset")} className={tab("reset")}>
            ↺ Reiniciar
          </button>
        )}
      </div>

      {panel === "result" && (
        <div className="panel-enter">
          <MatchResultForm
            action={onResult}
            teamAId={teamAId}
            teamBId={teamBId}
            teamAName={teamAName}
            teamBName={teamBName}
            allowDraws={allowDraws}
            defaultScoreA={played ? scoreA : null}
            defaultScoreB={played ? scoreB : null}
            submitLabel={played ? "Guardar corrección" : "Cargar resultado"}
            onDone={() => setPanel(null)}
          />
        </div>
      )}

      {panel === "schedule" && (
        <div className="panel-enter">
          <MatchScheduleForm
            matchId={matchId}
            courtId={courtId}
            turno={turno}
            courts={courts}
            competitionDisciplineId={competitionDisciplineId}
            disciplineNameById={disciplineNameById}
            onSchedule={onSchedule}
          />
        </div>
      )}

      {panel === "forfeit" && (
        <ForfeitPanel
          teamAName={teamAName}
          teamBName={teamBName}
          woScore={woScore}
          knockout={false}
          onForfeit={onForfeit}
          onDone={() => setPanel(null)}
        />
      )}

      {panel === "reset" && (
        <div className="flex flex-col gap-2 rounded-md border border-red-500/30 bg-red-500/8 p-2.5 text-xs max-w-md panel-enter">
          <span className="panel-label">
            {played
              ? "Se borra el resultado, los rounds y las tarjetas de este partido y vuelve a quedar para jugar."
              : "Se corta el partido en curso (reloj, rounds y tarjetas en cero) y vuelve a quedar para jugar."}{" "}
            ¿Reiniciar?
          </span>
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={confirmReset}
              disabled={pending}
              className="rounded panel-button-danger px-3 py-1.5 font-medium disabled:opacity-50"
            >
              {pending ? "…" : "Sí, reiniciar"}
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={pending}
              className="rounded panel-button-secondary px-3 py-1.5"
            >
              Cancelar
            </button>
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-500 panel-enter">{error}</p>}
    </div>
  );
}
