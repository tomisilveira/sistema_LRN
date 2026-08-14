import type { GroupStandingRow } from "@/lib/database.types";
import { ManualRankInput } from "./manual-rank-input";

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
      <h3 className="text-sm font-medium mb-2">{groupName}</h3>
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
              <tr key={r.team_id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1.5 pr-2 panel-label">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">
                  {r.team_name}
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
