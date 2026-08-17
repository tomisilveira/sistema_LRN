import { LiveMatchElapsed } from "./live-match-elapsed";

export interface LiveMatchInfo {
  matchId: string;
  disciplineCategory: string;
  dotClass: string;
  teamAName: string;
  teamBName: string;
  courtName: string | null;
  startedAt: string | null;
}

/** Apartado fijo con los partidos que están en curso AHORA en el evento
 * (cualquier torneo), para que se note de entrada sin tener que ir
 * cambiando de pestaña de disciplina en disciplina. Se actualiza solo vía
 * PublicRealtime (router.refresh() en cada cambio de `matches`). No se
 * renderiza nada si no hay ningún partido en curso. */
export function PublicLiveNowPanel({ matches }: { matches: LiveMatchInfo[] }) {
  if (matches.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-red-500/40 bg-red-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          En vivo ahora
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {matches.map((m) => (
          <div key={m.matchId} className="panel-card rounded-lg px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs panel-label">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dotClass}`} aria-hidden="true" />
              <span className="truncate">{m.disciplineCategory}</span>
            </div>
            <p className="text-sm font-medium">
              {m.teamAName} <span className="panel-label font-normal">vs</span> {m.teamBName}
            </p>
            <div className="flex items-center justify-between text-xs panel-label">
              <span>{m.courtName ? `🏟 ${m.courtName}` : "Sin cancha"}</span>
              {m.startedAt && (
                <span className="text-red-600 dark:text-red-400 font-medium tabular-nums">
                  ⏱ <LiveMatchElapsed startedAt={m.startedAt} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
