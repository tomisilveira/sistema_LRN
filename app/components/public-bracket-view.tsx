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
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
      {rounds.map(([round, ms], ri) => (
        <div key={round} className="flex flex-col min-w-[190px]">
          <p className="text-xs text-brand-teal-dark dark:text-brand-teal font-semibold uppercase tracking-wide text-center pb-2 mb-2 border-b-2 border-brand-teal/30">
            {roundName(round)}
          </p>
          <div className="flex-1 flex flex-col justify-center" style={{ gap: `${Math.pow(2, ri) * 1.1}rem` }}>
            {ms.map((m) => {
              const decided = m.status === "completed";
              return (
                <div
                  key={m.id}
                  className={`panel-card rounded-xl p-3 space-y-2 border-l-4 transition-colors duration-300 panel-enter ${
                    decided ? "border-brand-green" : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  <TeamLine
                    name={m.team_a_name}
                    won={m.winner_id !== null && m.winner_id === m.team_a_id}
                    score={m.score_a}
                  />
                  <TeamLine
                    name={m.team_b_name}
                    won={m.winner_id !== null && m.winner_id === m.team_b_id}
                    score={m.score_b}
                  />
                </div>
              );
            })}
          </div>
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
      <span className="truncate">{won && "🏆 "}{name ?? "Por definir"}</span>
      {score !== null && <span className="shrink-0 ml-2">{score}</span>}
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
