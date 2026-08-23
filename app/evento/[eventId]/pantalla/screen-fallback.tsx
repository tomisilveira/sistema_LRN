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
    <div className="grid gap-4 lg:grid-cols-2 panel-enter-stagger">
      {boards.map((board) => (
        <div key={board.competitionId} className="panel-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${board.dotClass}`} aria-hidden="true" />
            <p className="text-lg font-display font-bold">{board.title}</p>
          </div>

          {board.phase === "groups" ? (
            <div className="grid sm:grid-cols-2 gap-3 text-base">
              {board.standings.map((s) => (
                <PublicStandingsTable key={s.groupName} groupName={s.groupName} rows={s.rows} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {board.brackets.map((b) => (
                <div key={b.bracketType ?? "plain"} className="space-y-2">
                  {board.brackets.length > 1 && <p className="text-sm font-semibold panel-label">{b.label}</p>}
                  <PublicBracketView matches={b.matches} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
