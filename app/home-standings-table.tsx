import type { GroupStandingRow } from "@/lib/database.types";

/** Versión clara/oscura de app/publico/[eventId]/[competitionId]/public-standings-table.tsx,
 * para el inicio (que sí tiene toggle de tema) — la de /publico se queda
 * fija en oscuro a propósito, no se toca. */
export function HomeStandingsTable({ groupName, rows }: { groupName: string; rows: GroupStandingRow[] }) {
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
              <tr key={r.team_id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td
                  className={`py-1.5 pr-2 ${i === 0 ? "text-brand-green font-semibold" : "panel-label"}`}
                >
                  {i + 1}
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
