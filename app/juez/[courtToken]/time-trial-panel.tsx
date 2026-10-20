"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamLabel } from "@/app/components/team-label";
import { formatRunTime, parseRunTime } from "@/lib/time-trial";

export interface JudgeTimeTrialRobot {
  teamId: string;
  name: string;
  memberNames: string | null;
  runs: { attempt: number; timeMs: number | null; finished: boolean }[];
}

export interface JudgeTimeTrialCompetition {
  id: string;
  label: string;
  attempts: number;
  maxSeconds: number | null;
  robots: JudgeTimeTrialRobot[];
}

export interface JudgeLastRun {
  id: string;
  competitionId: string;
  teamName: string;
  attempt: number;
  timeMs: number | null;
}

/** Pantalla del juez para la contrarreloj (seguidor de línea): elegir el
 * robot que sale a pista, cronómetro en la tablet (Largar / Llegada), el
 * tiempo se puede corregir a mano antes de guardar (sensores o cronómetro
 * aparte), y se confirma antes de guardar. El último intento cargado desde
 * esta cancha se puede deshacer. */
export function TimeTrialPanel({
  courtToken,
  competitions,
  lastRun,
}: {
  courtToken: string;
  competitions: JudgeTimeTrialCompetition[];
  lastRun: JudgeLastRun | null;
}) {
  const router = useRouter();
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "");
  const [robotId, setRobotId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const competition = competitions.find((c) => c.id === competitionId) ?? competitions[0];
  if (!competition) return null;
  const robot = robotId ? competition.robots.find((r) => r.teamId === robotId) ?? null : null;

  async function undo() {
    if (!lastRun) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/time-trials/runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtToken, competitionId: lastRun.competitionId, runId: lastRun.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "No se pudo deshacer.");
      else setNotice(`Se deshizo el intento ${lastRun.attempt} de ${lastRun.teamName}.`);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
    } finally {
      setPending(false);
      setConfirmingUndo(false);
    }
  }

  if (robot) {
    return (
      <RunScreen
        key={`${robot.teamId}-${robot.runs.length}`}
        courtToken={courtToken}
        competition={competition}
        robot={robot}
        onClose={(msg) => {
          setRobotId(null);
          setNotice(msg ?? null);
          router.refresh();
        }}
      />
    );
  }

  const pendingRobots = competition.robots
    .filter((r) => r.runs.length < competition.attempts)
    .sort((a, b) => a.runs.length - b.runs.length || a.name.localeCompare(b.name));
  const doneRobots = competition.robots.filter((r) => r.runs.length >= competition.attempts);

  return (
    <section className="space-y-4 panel-enter">
      {competitions.length > 1 && (
        <div className="flex gap-2">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => setCompetitionId(c.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-display font-semibold ${
                c.id === competition.id ? "panel-button-primary" : "panel-button-secondary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p className="rounded-lg panel-chip-success px-3 py-2 text-sm panel-enter">{notice}</p>
      )}
      {error && <p className="text-sm text-red-500 panel-enter">{error}</p>}

      <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
        Contrarreloj · {competition.attempts} intento{competition.attempts === 1 ? "" : "s"} por robot
        {competition.maxSeconds ? ` · máx. ${formatRunTime(competition.maxSeconds * 1000)}` : ""}
      </p>

      {pendingRobots.length === 0 ? (
        <p className="text-sm panel-label">Todos los robots ya corrieron sus intentos.</p>
      ) : (
        <div className="space-y-2 panel-enter-stagger">
          {pendingRobots.map((r) => (
            <button
              key={r.teamId}
              onClick={() => {
                setNotice(null);
                setError(null);
                setRobotId(r.teamId);
              }}
              className="w-full text-left panel-card rounded-xl p-4 flex items-center justify-between gap-3 hover:border-brand-teal/50 transition active:scale-[0.99]"
            >
              <span className="min-w-0 text-lg font-display font-semibold">
                <TeamLabel name={r.name} memberNames={r.memberNames} />
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs panel-label">
                  Intento {r.runs.length + 1} de {competition.attempts}
                </span>
                <span className="block text-sm font-semibold">{bestLabel(r)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {lastRun && lastRun.competitionId === competition.id && (
        confirmingUndo ? (
          <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-3 space-y-2 panel-enter">
            <p className="text-sm panel-label">
              ¿Deshacer el intento {lastRun.attempt} de {lastRun.teamName} (
              {lastRun.timeMs === null ? "no terminó" : formatRunTime(lastRun.timeMs)})? Vuelve a quedar para correr.
            </p>
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={pending}
                className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-2 text-sm disabled:opacity-50"
              >
                Sí, deshacer
              </button>
              <button
                onClick={() => setConfirmingUndo(false)}
                disabled={pending}
                className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-2 text-sm"
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingUndo(true)}
            className="w-full rounded-lg py-2 text-sm font-display font-semibold border border-neutral-300 panel-label hover:bg-neutral-200 transition"
          >
            ↶ Deshacer último intento ({lastRun.teamName})
          </button>
        )
      )}

      {doneRobots.length > 0 && (
        <div className="pt-2">
          <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold mb-2">Ya corrieron</p>
          <ul className="space-y-1 text-sm">
            {doneRobots.map((r) => (
              <li key={r.teamId} className="flex justify-between gap-2 panel-label">
                <span className="truncate">{r.name}</span>
                <span className="font-semibold text-neutral-700">{bestLabel(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function bestLabel(r: JudgeTimeTrialRobot): string {
  const times = r.runs.filter((x) => x.finished && x.timeMs !== null).map((x) => x.timeMs as number);
  if (times.length > 0) return `Mejor: ${formatRunTime(Math.min(...times))}`;
  return r.runs.length > 0 ? "Sin tiempo" : "—";
}

type Phase = "ready" | "running" | "stopped";

function RunScreen({
  courtToken,
  competition,
  robot,
  onClose,
}: {
  courtToken: string;
  competition: JudgeTimeTrialCompetition;
  robot: JudgeTimeTrialRobot;
  onClose: (notice?: string) => void;
}) {
  const attempt = robot.runs.length + 1;
  const maxMs = competition.maxSeconds ? competition.maxSeconds * 1000 : null;
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [timeText, setTimeText] = useState("");
  const [dnf, setDnf] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (startRef.current === null) return;
      const ms = performance.now() - startRef.current;
      if (maxMs && ms >= maxMs) {
        // Pasó el tiempo máximo: se corta solo y queda como "no terminó".
        setElapsed(maxMs);
        setPhase("stopped");
        setDnf(true);
        setTimeText("");
        return;
      }
      setElapsed(ms);
    }, 31);
    return () => clearInterval(id);
  }, [phase, maxMs]);

  function start() {
    setError(null);
    setDnf(false);
    startRef.current = performance.now();
    setElapsed(0);
    setPhase("running");
  }

  function stop() {
    if (startRef.current === null) return;
    const ms = performance.now() - startRef.current;
    setElapsed(ms);
    setTimeText(formatRunTime(ms));
    setPhase("stopped");
  }

  function reset() {
    startRef.current = null;
    setElapsed(0);
    setTimeText("");
    setDnf(false);
    setPhase("ready");
    setError(null);
  }

  const typedMs = parseRunTime(timeText);
  const overMax = !dnf && typedMs !== null && maxMs !== null && typedMs > maxMs;
  const canSave = dnf || typedMs !== null;

  function askConfirm() {
    setError(null);
    if (!canSave) {
      setError("Escribí el tiempo (ej. 12.34 o 1:05.20) o marcá que no terminó.");
      return;
    }
    setConfirming(true);
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/time-trials/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtToken,
          competitionId: competition.id,
          teamId: robot.teamId,
          timeMs: dnf || overMax ? null : typedMs,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar el intento.");
        setConfirming(false);
        setSubmitting(false);
        return;
      }
      onClose(
        dnf || overMax
          ? `${robot.name}: intento ${attempt} guardado como "no terminó".`
          : `${robot.name}: intento ${attempt} guardado — ${formatRunTime(typedMs)}.`
      );
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      setConfirming(false);
      setSubmitting(false);
    }
  }

  const finalLabel = dnf || overMax ? "No terminó" : formatRunTime(typedMs);

  return (
    <section className="panel-card rounded-xl p-5 space-y-5 panel-enter">
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-wide panel-label font-display font-semibold">
          {competition.label} · Intento {attempt} de {competition.attempts}
        </p>
        <p className="text-xl font-display font-semibold">
          <TeamLabel name={robot.name} memberNames={robot.memberNames} />
        </p>
        {robot.runs.length > 0 && (
          <p className="text-xs panel-label">
            Anteriores:{" "}
            {robot.runs.map((r) => (r.finished ? formatRunTime(r.timeMs) : "no terminó")).join(" · ")}
          </p>
        )}
      </div>

      <div
        className={`rounded-2xl py-6 text-center font-mono font-bold text-6xl tabular-nums text-white ${
          phase === "running" ? "bg-brand-orange" : dnf ? "bg-neutral-500" : "bg-brand-teal"
        }`}
      >
        {/* Parado: muestra lo que se va a guardar (el tiempo corregido a mano
            si se tocó el casillero), no el del cronómetro. */}
        {phase === "stopped" && typedMs !== null && !dnf ? formatRunTime(typedMs) : formatRunTime(Math.max(0, elapsed))}
      </div>
      {maxMs && (
        <p className="-mt-3 text-center text-xs panel-label">Tiempo máximo: {formatRunTime(maxMs)}</p>
      )}

      {confirming ? (
        <div className="rounded-xl border-2 border-brand-orange/60 bg-brand-orange/8 p-4 space-y-3 panel-enter">
          <p className="text-xs uppercase tracking-wide font-display font-semibold text-brand-orange">
            Revisá antes de guardar
          </p>
          <div className="rounded-lg bg-white/70 px-3 py-2 text-center">
            <p className="text-sm panel-label">
              {robot.name} · intento {attempt}
            </p>
            <p className="text-3xl font-display font-bold tabular-nums">{finalLabel}</p>
            {overMax && <p className="text-xs text-brand-orange">Pasó el tiempo máximo: cuenta como no terminó.</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={submitting}
              className="flex-1 rounded-lg panel-button-primary font-display font-semibold py-3 text-sm disabled:opacity-50"
            >
              {submitting ? "Guardando…" : "Sí, guardar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-1 rounded-lg panel-button-secondary font-display font-semibold py-3 text-sm"
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <>
          {phase === "ready" && (
            <button
              onClick={start}
              className="w-full rounded-xl panel-button-primary font-display font-bold py-5 text-xl"
            >
              ▶ Largar
            </button>
          )}
          {phase === "running" && (
            <button
              onClick={stop}
              className="w-full rounded-xl panel-button-accent font-display font-bold py-5 text-xl"
            >
              ⏹ Llegada
            </button>
          )}

          {phase !== "running" && (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs panel-label mb-1">
                  Tiempo (podés corregirlo o escribirlo a mano: 12.34 o 1:05.20)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={timeText}
                  onChange={(e) => {
                    setTimeText(e.target.value);
                    if (e.target.value.trim()) setDnf(false);
                  }}
                  disabled={dnf}
                  placeholder="0.00"
                  className="w-full text-center text-2xl rounded-lg panel-input py-3 tabular-nums disabled:opacity-40"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dnf} onChange={(e) => setDnf(e.target.checked)} className="rounded" />
                No terminó (se salió, se quedó quieto o pasó el tiempo máximo)
              </label>
              {overMax && (
                <p className="text-xs text-brand-orange">
                  Ese tiempo pasa el máximo: se va a guardar como &ldquo;no terminó&rdquo;.
                </p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={askConfirm}
                className="w-full rounded-lg panel-button-primary font-display font-semibold py-3 disabled:opacity-40"
                disabled={!canSave}
              >
                Guardar intento
              </button>
              {phase === "stopped" && (
                <button
                  onClick={reset}
                  className="w-full rounded-lg panel-button-secondary font-display font-semibold py-2.5 text-sm"
                >
                  ↺ Reiniciar cronómetro (largada en falso)
                </button>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={() => onClose()} className="block mx-auto text-sm panel-label underline">
        Volver a la lista
      </button>
    </section>
  );
}
