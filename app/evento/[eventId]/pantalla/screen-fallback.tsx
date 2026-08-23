import type { PantallaCompetitionBoard } from "@/lib/build-pantalla-fallback";
import { PublicStandingsTable } from "@/app/components/public-standings-table";
import { PublicBracketView } from "@/app/components/public-bracket-view";

/** Estado "sin partidos en vivo" de Modo Pantalla: una tarjeta grande por
 * torneo del evento, mostrando su fase actual — tabla de posiciones si
 * sigue en fase de grupos, cuadro (uno o dos, oro/plata) si ya pasó a fase
 * final. Reusa los mismos componentes presentacionales que /publico
 * (PublicStandingsTable / PublicBracketView), solo con más aire para
 * leerse de lejos. */
export function ScreenFallback({ boards }: { boards: PantallaCompetitionBoard[] }) {
  if (boards.length === 0) {
    return <p className="text-lg panel-label text-center py-16">No hay partidos en curso ni programados ahora.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 panel-enter-stagger">
      {boards.map((board) => (
        <div
          key={board.competitionId}
          className={`panel-card rounded-2xl overflow-hidden border-t-4 ${board.borderClass}`}
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-3 h-3 rounded-full shrink-0 ${board.dotClass}`} aria-hidden="true" />
              <p className="text-xl font-display font-bold truncate">{board.title}</p>
            </div>
            <span className="shrink-0 text-[11px] uppercase tracking-wide font-display font-semibold panel-chip rounded-full px-2.5 py-1">
              {board.phase === "groups" ? "Fase de grupos" : "Fase final"}
            </span>
          </div>

          <div className="px-5 pb-5">
            {board.phase === "groups" ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {board.standings.map((s) => (
                  <PublicStandingsTable key={s.groupName} groupName={s.groupName} rows={s.rows} />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {board.brackets.map((b) => (
                  <div key={b.bracketType ?? "plain"} className="space-y-2">
                    {board.brackets.length > 1 && (
                      <p className="inline-block text-xs font-display font-bold uppercase tracking-wide panel-chip-brand rounded-full px-2.5 py-1">
                        {b.label}
                      </p>
                    )}
                    <PublicBracketView matches={b.matches} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
