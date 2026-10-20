import { TeamLabel } from "./team-label";
import { formatRunTime, type TimeTrialRankingRow } from "@/lib/time-trial";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Ranking público de una contrarreloj (seguidor de línea): puesto, robot,
 * cada intento y el mejor tiempo. Claro/oscuro con el mismo root de tema que
 * PublicStandingsTable. */
export function PublicTimeTrialTable({ rows, attempts }: { rows: TimeTrialRankingRow[]; attempts: number }) {
  const attemptNumbers = Array.from({ length: attempts }, (_, i) => i + 1);
  return (
    <div className="panel-surface rounded-xl overflow-hidden">
      <h3 className="text-sm font-display font-bold uppercase tracking-wide text-white bg-brand-teal-dark px-3 py-2">
        Tiempos — vale el mejor intento
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="panel-label text-xs uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-800">
              <th className="text-left font-semibold py-2 pl-3 pr-2">#</th>
              <th className="text-left font-semibold py-2 pr-2">Robot</th>
              {attemptNumbers.map((n) => (
                <th key={n} className="text-center font-semibold py-2 px-1.5">
                  Int. {n}
                </th>
              ))}
              <th className="text-center font-semibold py-2 pl-1.5 pr-3 text-brand-orange">Mejor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pl-3 pr-2 font-semibold whitespace-nowrap">
                  {r.position ? `${MEDAL[r.position] ?? ""} ${r.position}` : "—"}
                </td>
                <td className="py-2 pr-2 font-semibold text-[15px] max-w-[14rem]">
                  <TeamLabel name={r.team.name} memberNames={r.team.member_names} className="block" />
                </td>
                {attemptNumbers.map((n) => {
                  const run = r.runs.find((x) => x.attempt === n);
                  return (
                    <td key={n} className="text-center py-2 px-1.5 tabular-nums panel-label">
                      {run ? (run.finished ? formatRunTime(run.time_ms) : "NT") : ""}
                    </td>
                  );
                })}
                <td className="text-center py-2 pl-1.5 pr-3 font-display font-bold tabular-nums">
                  {formatRunTime(r.bestMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs panel-label border-t border-neutral-200 dark:border-neutral-800">
        NT = no terminó el recorrido.
      </p>
    </div>
  );
}
