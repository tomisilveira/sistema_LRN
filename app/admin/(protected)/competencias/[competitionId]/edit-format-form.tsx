"use client";

import { useState } from "react";
import type { Competition } from "@/lib/database.types";
import { updateCompetitionFormat } from "./actions";

export function EditFormatForm({ competitionId, competition }: { competitionId: string; competition: Competition }) {
  const action = updateCompetitionFormat.bind(null, competitionId);
  const [timerMode, setTimerMode] = useState<"periods" | "rounds">(competition.timer_mode);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="block text-sm panel-label mb-1">Formato</label>
        <select
          name="format_type"
          defaultValue={competition.format_type}
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        >
          <option value="groups_only">Solo fase de grupos (sin eliminatoria)</option>
          <option value="single_elimination">Grupos + eliminatoria simple</option>
          <option value="gold_silver">Grupos + oro/plata</option>
          <option value="bracket_only">Solo cuadro de eliminación (sin grupos)</option>
        </select>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs panel-label mb-1">Pts. victoria</label>
          <input
            name="points_win"
            type="number"
            defaultValue={competition.points_win}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Pts. empate</label>
          <input
            name="points_draw"
            type="number"
            defaultValue={competition.points_draw}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Pts. derrota</label>
          <input
            name="points_loss"
            type="number"
            defaultValue={competition.points_loss}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Clasif./grupo</label>
          <input
            name="qualifiers_per_group"
            type="number"
            defaultValue={competition.qualifiers_per_group}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="allow_draws" type="checkbox" defaultChecked={competition.allow_draws} className="rounded" />
        Esta disciplina admite empates (desmarcar para sumo)
      </label>
      <p className="text-xs panel-label">
        Todo cuadro con semifinales incluye el partido por el 3er puesto (perdedores de las semis),
        que se juega antes de la final.
      </p>

      <div className="rounded-md panel-surface border-l-4 border-brand-teal/40 p-3 space-y-3">
        <div>
          <label className="block text-sm panel-label mb-1">Reloj del partido</label>
          <select
            name="timer_mode"
            value={timerMode}
            onChange={(e) => setTimerMode(e.target.value as "periods" | "rounds")}
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          >
            <option value="periods">Tiempos con marcador acumulado (fútbol)</option>
            <option value="rounds">Rounds al mejor de N, sin marcador (sumo)</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs panel-label mb-1">
              Segundos por {timerMode === "rounds" ? "round" : "tiempo"}
            </label>
            <input
              name="period_seconds"
              type="number"
              min={1}
              defaultValue={competition.period_seconds ?? ""}
              placeholder="120"
              className="w-full rounded-md panel-input px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs panel-label mb-1">
              {timerMode === "rounds" ? "Máx. de rounds" : "Cantidad de tiempos"}
            </label>
            <input
              name="periods_count"
              type="number"
              min={1}
              defaultValue={competition.periods_count}
              className="w-full rounded-md panel-input px-2 py-2 text-sm"
            />
          </div>
          {timerMode === "rounds" && (
            <div>
              <label className="block text-xs panel-label mb-1">Rounds para ganar</label>
              <input
                name="rounds_to_win"
                type="number"
                min={1}
                defaultValue={competition.rounds_to_win ?? 2}
                className="w-full rounded-md panel-input px-2 py-2 text-sm"
              />
            </div>
          )}
        </div>
        <p className="text-xs panel-label">
          {timerMode === "rounds"
            ? "Ej. sumo: 2 minutos, 3 rounds máximo, gana quien llega a 2 rounds ganados."
            : "Ej. fútbol: 3 minutos por tiempo, 2 tiempos — el marcador se acumula entre tiempos."}
        </p>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">
          Guardar formato
        </button>
        <button type="reset" className="rounded-md panel-button-secondary px-4 py-2 text-sm">
          Restablecer
        </button>
      </div>
    </form>
  );
}
