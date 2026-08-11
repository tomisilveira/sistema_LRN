import type { GroupStandingRow } from "@/lib/database.types";
import { setManualRankOverride } from "./actions";

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
  const setRank = setManualRankOverride.bind(null, competitionId, groupId);

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{groupName}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 text-xs">
              <th className="text-left font-normal py-1 pr-2">#</th>
              <th className="text-left font-normal py-1 pr-2">Equipo</th>
              <th className="text-center font-normal py-1 px-1">PJ</th>
              <th className="text-center font-normal py-1 px-1">G</th>
              <th className="text-center font-normal py-1 px-1">E</th>
              <th className="text-center font-normal py-1 px-1">P</th>
              <th className="text-center font-normal py-1 px-1">DIF</th>
              <th className="text-center font-normal py-1 px-1">Pts</th>
              {editable && <th className="text-center font-normal py-1 pl-2">Orden manual</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} className="border-t border-neutral-800">
                <td className="py-1.5 pr-2 text-neutral-500">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{r.team_name}</td>
                <td className="text-center py-1.5 px-1">{r.played}</td>
                <td className="text-center py-1.5 px-1">{r.won}</td>
                <td className="text-center py-1.5 px-1">{r.drawn}</td>
                <td className="text-center py-1.5 px-1">{r.lost}</td>
                <td className="text-center py-1.5 px-1">{r.score_diff}</td>
                <td className="text-center py-1.5 px-1 font-semibold">{r.points}</td>
                {editable && (
                  <td className="text-center py-1.5 pl-2">
                    <form action={setRank.bind(null, r.team_id)} className="inline-flex items-center gap-1">
                      <input
                        name="rank"
                        type="number"
                        min={1}
                        defaultValue={r.manual_rank_override ?? ""}
                        placeholder="-"
                        className="w-12 rounded bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-xs text-center"
                      />
                      <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-200">
                        OK
                      </button>
                    </form>
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
