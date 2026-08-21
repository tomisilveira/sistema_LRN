import type { GroupStandingRow } from "@/lib/database.types";

/** Tabla de posiciones clara/oscura compartida entre el inicio y
 * /publico/[eventId]/[competitionId] — ambos usan el mismo root de tema
 * (ver public-shell.tsx). */
export function PublicStandingsTable({ groupName, rows }: { groupName: string; rows: GroupStandingRow[] }) {
  return (
    <div className="panel-card rounded-lg p-3">
      <h3 className="text-sm font-semibold text-brand-teal-dark dark:text-brand-teal mb-2">{groupName}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="panel-label text-xs">
              <th className="text-left font-normal py-1 pr-2">#</th>
              <th className="text-left font-normal py-1 pr-2">Equipo</th>
              <th className="text-center font-normal py-1 px-1">PJ</th>
              <th className="text-center font-normal py-1 px-1">G</th>
              <th className="text-center font-normal py-1 px-1">E</th>
              <th className="text-center font-normal py-1 px-1">P</th>
              <th className="text-center font-normal py-1 px-1">DIF</th>
              <th className="text-center font-normal py-1 px-1 text-brand-orange">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.team_id}
                className={`border-t border-neutral-200 dark:border-neutral-800 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 ${
                  i % 2 === 1 ? "bg-neutral-50/60 dark:bg-neutral-900/40" : ""
                }`}
              >
                <td className="py-1.5 pr-2">
                  <RankBadge rank={i + 1} />
                </td>
                <td className="py-1.5 pr-2 font-medium">{r.team_name}</td>
                <td className="text-center py-1.5 px-1">{r.played}</td>
                <td className="text-center py-1.5 px-1">{r.won}</td>
                <td className="text-center py-1.5 px-1">{r.drawn}</td>
                <td className="text-center py-1.5 px-1">{r.lost}</td>
                <td className="text-center py-1.5 px-1">{r.score_diff}</td>
                <td className="text-center py-1.5 px-1 font-semibold text-brand-orange">{r.points}</td>
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
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs font-bold ${styles[rank as 1 | 2 | 3]}`}
    >
      {rank}
    </span>
  );
}
