"use client";

import { useState, useTransition } from "react";
import { TeamLabel } from "@/app/components/team-label";
import { formatRunTime } from "@/lib/time-trial";
import type { CompetitionStatus } from "@/lib/database.types";
import { deleteTimeTrialRun, saveTimeTrialRun, setTimeTrialStatus } from "./time-trial-actions";

export interface AdminTimeTrialRow {
  teamId: string;
  name: string;
  memberNames: string | null;
  position: number | null;
  bestMs: number | null;
  runs: Record<number, { id: string; timeMs: number | null; finished: boolean }>;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Pestaña Tiempos de un torneo contrarreloj: iniciar/terminar, ranking
 * con cada intento, y corrección a mano de cualquier intento (tocar la
 * celda). Los jueces cargan los tiempos desde la pantalla de su cancha. */
export function TimeTrialAdmin({
  competitionId,
  status,
  attempts,
  maxSeconds,
  rows,
}: {
  competitionId: string;
  status: CompetitionStatus;
  attempts: number;
  maxSeconds: number | null;
  rows: AdminTimeTrialRow[];
}) {
  const [editing, setEditing] = useState<{ teamId: string; attempt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmFinish, setConfirmFinish] = useState(false);

  const running = status !== "setup" && status !== "finished";
  const attemptNumbers = Array.from({ length: attempts }, (_, i) => i + 1);
  const editRow = editing ? rows.find((r) => r.teamId === editing.teamId) ?? null : null;
  const editRun = editing && editRow ? editRow.runs[editing.attempt] ?? null : null;

  function changeStatus(next: "running" | "finished") {
    setError(null);
    startTransition(async () => {
      const res = await setTimeTrialStatus(competitionId, next);
      if (!res.ok) setError(res.error ?? "No se pudo cambiar el estado.");
      setConfirmFinish(false);
    });
  }

  return (
    <section className="panel-card rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Tiempos</h2>
          <p className="text-xs panel-label mt-0.5">
            {attempts} intento{attempts === 1 ? "" : "s"} por robot
            {maxSeconds ? ` · máximo ${formatRunTime(maxSeconds * 1000)} por intento` : ""} · vale el mejor
            tiempo (desempata el segundo mejor). Los jueces cargan los tiempos desde la pantalla de la cancha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "setup" && (
            <button
              onClick={() => changeStatus("running")}
              disabled={pending}
              className="text-sm rounded-md panel-button-primary font-medium px-4 py-2 disabled:opacity-50"
            >
              ▶️ Iniciar torneo
            </button>
          )}
          {running &&
            (confirmFinish ? (
              <span className="inline-flex flex-col gap-1.5 rounded-md border border-brand-orange/40 bg-brand-orange/8 p-2 text-xs max-w-[260px]">
                <span className="panel-label">
                  Se cierra el torneo con estos tiempos y queda el podio. Se puede reabrir. ¿Terminar?
                </span>
                <span className="flex gap-1.5">
                  <button
                    onClick={() => changeStatus("finished")}
                    disabled={pending}
                    className="flex-1 rounded panel-button-primary py-1.5 font-medium"
                  >
                    Sí, terminar
                  </button>
                  <button onClick={() => setConfirmFinish(false)} className="flex-1 rounded panel-button-secondary py-1.5">
                    Cancelar
                  </button>
                </span>
              </span>
            ) : (
              <button
                onClick={() => setConfirmFinish(true)}
                className="text-sm rounded-md panel-button-secondary px-4 py-2"
              >
                🏁 Terminar torneo
              </button>
            ))}
          {status === "finished" && (
            <button
              onClick={() => changeStatus("running")}
              disabled={pending}
              className="text-sm rounded-md panel-button-secondary px-4 py-2 disabled:opacity-50"
            >
              ↺ Reabrir
            </button>
          )}
        </div>
      </div>

      {status === "setup" && (
        <p className="text-sm rounded-lg panel-chip-warning px-3 py-2">
          Cuando estén los robots cargados, apretá &ldquo;Iniciar torneo&rdquo;: a partir de ahí los jueces de las
          canchas de seguidor de línea pueden tomar tiempos.
        </p>
      )}
      {error && <p className="text-sm text-red-500 panel-enter">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm panel-label">Todavía no hay robots inscriptos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="panel-label text-xs">
                <th className="text-left font-normal py-1 pr-2 w-10">#</th>
                <th className="text-left font-normal py-1 pr-2">Robot</th>
                {attemptNumbers.map((n) => (
                  <th key={n} className="text-center font-normal py-1 px-1">
                    Intento {n}
                  </th>
                ))}
                <th className="text-center font-normal py-1 pl-2">Mejor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className="border-t border-neutral-200">
                  <td className="py-2 pr-2 font-semibold">
                    {r.position ? `${MEDAL[r.position] ?? ""} ${r.position}` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-[15px]">
                    <TeamLabel name={r.name} memberNames={r.memberNames} />
                  </td>
                  {attemptNumbers.map((n) => {
                    const run = r.runs[n];
                    const isEditing = editing?.teamId === r.teamId && editing.attempt === n;
                    return (
                      <td key={n} className="text-center py-2 px-1">
                        <button
                          onClick={() => {
                            setError(null);
                            setEditing(isEditing ? null : { teamId: r.teamId, attempt: n });
                          }}
                          title={run ? "Corregir este intento" : "Cargar este intento a mano"}
                          className={`min-w-[4.5rem] rounded-md px-2 py-1 tabular-nums transition-colors ${
                            isEditing
                              ? "panel-button-primary"
                              : run
                                ? run.finished
                                  ? run.timeMs === r.bestMs
                                    ? "bg-brand-green/12 text-brand-green font-semibold hover:bg-brand-green/20"
                                    : "hover:bg-neutral-100"
                                  : "text-neutral-500 hover:bg-neutral-100"
                                : "text-neutral-300 hover:bg-neutral-100"
                          }`}
                        >
                          {run ? (run.finished ? formatRunTime(run.timeMs) : "No terminó") : "+"}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-center py-2 pl-2 font-display font-bold tabular-nums">
                    {formatRunTime(r.bestMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && editRow && (
        <RunEditor
          key={`${editing.teamId}-${editing.attempt}`}
          competitionId={competitionId}
          teamId={editing.teamId}
          teamName={editRow.name}
          attempt={editing.attempt}
          run={editRun}
          onDone={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function RunEditor({
  competitionId,
  teamId,
  teamName,
  attempt,
  run,
  onDone,
}: {
  competitionId: string;
  teamId: string;
  teamName: string;
  attempt: number;
  run: { id: string; timeMs: number | null; finished: boolean } | null;
  onDone: () => void;
}) {
  const [time, setTime] = useState(run?.finished ? formatRunTime(run.timeMs) : "");
  const [dnf, setDnf] = useState(run ? !run.finished : false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("time", time);
    if (dnf) fd.set("dnf", "on");
    startTransition(async () => {
      const res = await saveTimeTrialRun(competitionId, teamId, attempt, fd);
      if (!res.ok) setError(res.error ?? "No se pudo guardar.");
      else onDone();
    });
  }

  function remove() {
    if (!run) return;
    startTransition(async () => {
      const res = await deleteTimeTrialRun(competitionId, run.id);
      if (!res.ok) setError(res.error ?? "No se pudo borrar.");
      else onDone();
    });
  }

  return (
    <div className="rounded-lg border border-brand-teal/40 bg-brand-teal/5 p-3 space-y-2.5 max-w-xl panel-enter">
      <p className="text-sm font-medium">
        {run ? "Corregir" : "Cargar"} intento {attempt} — {teamName}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            if (e.target.value.trim()) setDnf(false);
          }}
          disabled={dnf || pending}
          placeholder="12.34 o 1:05.20"
          className="w-36 rounded panel-input px-2 py-1.5 text-sm tabular-nums disabled:opacity-40"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={dnf} onChange={(e) => setDnf(e.target.checked)} className="rounded" />
          No terminó
        </label>
        <button
          onClick={save}
          disabled={pending}
          className="text-xs rounded panel-button-primary px-3 py-1.5 font-medium disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onDone} disabled={pending} className="text-xs rounded panel-button-secondary px-3 py-1.5">
          Cancelar
        </button>
        {run &&
          (confirmDelete ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="panel-label">¿Borrar este intento?</span>
              <button onClick={remove} disabled={pending} className="rounded panel-button-danger px-2 py-1">
                Sí, borrar
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded panel-button-secondary px-2 py-1">
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs rounded panel-button-secondary px-3 py-1.5 text-red-600"
            >
              🗑 Borrar intento
            </button>
          ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
