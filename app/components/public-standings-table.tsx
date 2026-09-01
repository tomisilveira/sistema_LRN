import type { GroupStandingRow } from "@/lib/database.types";
import { TeamLabel } from "./team-label";

/** Tabla de posiciones clara/oscura compartida entre el inicio y
 * /publico/[eventId]/[competitionId] — ambos usan el mismo root de tema
 * (ver public-shell.tsx). */
export function PublicStandingsTable({ groupName, rows }: { groupName: string; rows: GroupStandingRow[] }) {
  return (
    <div className="panel-surface rounded-xl overflow-hidden">
      <h3 className="text-sm font-display font-bold uppercase tracking-wide text-white bg-brand-teal-dark px-3 py-2">
        {groupName}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="panel-label text-xs uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-800">
              <th className="text-left font-semibold py-2 pl-3 pr-2">#</th>
              <th className="text-left font-semibold py-2 pr-2">Equipo</th>
              <th className="text-center font-semibold py-2 px-1.5">PJ</th>
              <th className="text-center font-semibold py-2 px-1.5">G</th>
              <th className="text-center font-semibold py-2 px-1.5">E</th>
              <th className="text-center font-semibold py-2 px-1.5">P</th>
              <th className="text-center font-semibold py-2 px-1.5">DIF</th>
              <th className="text-center font-semibold py-2 pl-1.5 pr-3 text-brand-orange">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.team_id}
                className={`border-t border-neutral-200 dark:border-neutral-800 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 ${
                  i % 2 === 1 ? "bg-neutral-50/60 dark:bg-neutral-900/40" : ""
                } ${i === 0 ? "font-medium" : ""}`}
              >
                <td className="py-2 pl-3 pr-2">
                  <RankBadge rank={i + 1} />
                </td>
                <td className="py-2 pr-2 font-semibold text-[15px] max-w-[14rem]">
                  <TeamLabel name={r.team_name} memberNames={r.member_names} className="block" />
                </td>
                <td className="text-center py-2 px-1.5 tabular-nums">{r.played}</td>
                <td className="text-center py-2 px-1.5 tabular-nums">{r.won}</td>
                <td className="text-center py-2 px-1.5 tabular-nums">{r.drawn}</td>
                <td className="text-center py-2 px-1.5 tabular-nums">{r.lost}</td>
                <td className="text-center py-2 px-1.5 tabular-nums">{r.score_diff}</td>
                <td className="text-center py-2 pl-1.5 pr-3 font-display font-bold text-brand-orange tabular-nums">
                  {r.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Numerito de puesto — los primeros 3 con un chip de color (oro/plata/
 * bronce) para que el podio se note de un vistazo. Misma idea que la
 * versión admin (standings-table.tsx), duplicada a propósito: son paquetes
 * de UI distintos (público vs. panel). */
function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span className="panel-label text-sm px-1.5">{rank}</span>;
  }
  const styles = {
    1: "bg-brand-orange/20 text-amber-800 dark:text-brand-orange border-brand-orange/40",
    2: "bg-neutral-300/40 text-neutral-700 dark:bg-neutral-400/20 dark:text-neutral-300 border-neutral-400/40",
    3: "bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal border-brand-teal/40",
  } as const;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-display font-bold ${styles[rank as 1 | 2 | 3]}`}
    >
      {rank}
    </span>
  );
}
