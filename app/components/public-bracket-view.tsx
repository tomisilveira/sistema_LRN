import type { Match } from "@/lib/database.types";

export interface BracketDisplayMatch extends Match {
  team_a_name: string | null;
  team_b_name: string | null;
}

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F"];

/** Cuadro eliminatorio claro/oscuro compartido entre el inicio y
 * /publico/[eventId]/[competitionId]. */
export function PublicBracketView({ matches }: { matches: BracketDisplayMatch[] }) {
  const byRound = new Map<string, BracketDisplayMatch[]>();
  for (const m of matches) {
    const key = m.round ?? "?";
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key)!.push(m);
  }
  const rounds = [...byRound.entries()]
    .sort(([a], [b]) => {
      const ia = ROUND_ORDER.indexOf(a);
      const ib = ROUND_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([round, ms]) => [round, ms.sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))] as const);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map(([round, ms]) => (
        <div key={round} className="flex flex-col justify-around gap-3 min-w-[180px]">
          <p className="text-xs text-brand-teal-dark dark:text-brand-teal font-semibold uppercase tracking-wide">
            {roundName(round)}
          </p>
          {ms.map((m) => (
            <div key={m.id} className="panel-card rounded-lg p-3 space-y-2">
              <TeamLine name={m.team_a_name} won={m.winner_id === m.team_a_id} score={m.score_a} />
              <TeamLine name={m.team_b_name} won={m.winner_id === m.team_b_id} score={m.score_b} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamLine({ name, won, score }: { name: string | null; won: boolean; score: number | null }) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${won ? "font-semibold text-brand-green" : "panel-label"}`}
    >
      <span>{name ?? "Por definir"}</span>
      {score !== null && <span>{score}</span>}
    </div>
  );
}

function roundName(code: string) {
  switch (code) {
    case "F":
      return "Final";
    case "SF":
      return "Semifinal";
    case "QF":
      return "Cuartos de final";
    case "R16":
      return "Dieciseisavos";
    case "R32":
      return "Treintaidosavos";
    default:
      return code;
  }
}
