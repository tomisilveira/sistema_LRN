import type { Match } from "@/lib/database.types";
import { LiveMatchElapsed } from "./live-match-elapsed";

export interface PublicMatchDisplay extends Match {
  team_a_name: string;
  team_b_name: string;
  court_name: string | null;
}

/** Fixture (partidos de fase de grupos) de solo lectura para el público —
 * antes esto no se mostraba en absoluto, solo la tabla de posiciones ya
 * calculada; ahora se puede ver qué se está jugando ahora mismo y cómo
 * terminaron los ya jugados, no solo el resumen. */
export function PublicMatchList({ matches }: { matches: PublicMatchDisplay[] }) {
  if (matches.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {matches.map((m) => (
        <div
          key={m.id}
          className={`rounded-md px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm border ${
            m.status === "in_progress"
              ? "border-red-500/50 bg-red-500/5"
              : "panel-surface border-transparent"
          }`}
        >
          <div className="min-w-[160px]">
            <span className={m.winner_id === m.team_a_id ? "font-semibold" : ""}>{m.team_a_name}</span>
            {" vs "}
            <span className={m.winner_id === m.team_b_id ? "font-semibold" : ""}>{m.team_b_name}</span>
            {m.status === "completed" && m.score_a !== null && m.score_b !== null && (
              <span className="panel-label"> · {m.score_a}-{m.score_b}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            {m.status === "in_progress" ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                En vivo{m.started_at && (
                  <>
                    {" · "}
                    <LiveMatchElapsed startedAt={m.started_at} />
                  </>
                )}
              </span>
            ) : m.status === "completed" ? (
              <span className="panel-chip-success rounded-full px-2 py-0.5 font-medium">✅ Jugado</span>
            ) : m.court_name ? (
              <span className="panel-chip rounded-full px-2 py-0.5">
                {m.court_name}
                {m.turno !== null ? ` · Turno ${m.turno}` : ""}
              </span>
            ) : (
              <span className="panel-label">Por programar</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
