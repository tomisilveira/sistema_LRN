import type { GroupStandingRow } from "@/lib/database.types";
import { ManualRankInput } from "./manual-rank-input";
import { TeamLabel } from "@/app/components/team-label";

export function StandingsTable({
  competitionId,
  groupId,
  groupName,
  rows,
  editable = false,
}: {
  competitionId: string;
  groupId: string;
  groupName: string;
  rows: GroupStandingRow[];
  editable?: boolean;
}) {
  return (
    <div>
      <h3 className="inline-block text-sm font-semibold mb-2 panel-chip-brand rounded-md px-2 py-0.5">{groupName}</h3>
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
              <th className="text-center font-normal py-1 px-1">Pts</th>
              {editable && (
                <th className="text-center font-normal py-1 pl-2 whitespace-nowrap">
                  Orden manual
                </th>
              )}
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
                <td className="py-1.5 pr-2 font-medium">
                  <TeamLabel name={r.team_name} memberNames={r.member_names} />
                  {r.manual_rank_override !== null && (
                    <span
                      className="ml-1 text-brand-orange"
                      title={`Posición forzada a mano: puesto ${r.manual_rank_override}`}
                    >
                      📌
                    </span>
                  )}
                </td>
                <td className="text-center py-1.5 px-1">{r.played}</td>
                <td className="text-center py-1.5 px-1">{r.won}</td>
                <td className="text-center py-1.5 px-1">{r.drawn}</td>
                <td className="text-center py-1.5 px-1">{r.lost}</td>
                <td className="text-center py-1.5 px-1">{r.score_diff}</td>
                <td className="text-center py-1.5 px-1 font-semibold">{r.points}</td>
                {editable && (
                  <td className="text-center py-1.5 pl-2">
                    <ManualRankInput
                      competitionId={competitionId}
                      groupId={groupId}
                      teamId={r.team_id}
                      defaultValue={r.manual_rank_override}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Numerito de puesto — los primeros 3 con un chip de color (oro/plata/
 * bronce con la paleta de marca) para que el podio se note de un vistazo,
 * el resto como texto plano igual que antes. */
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
