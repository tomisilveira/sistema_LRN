import type { Match, MatchCard } from "@/lib/database.types";
import { TeamLabel } from "./team-label";
import { TeamCardBadges } from "./team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";

export interface BracketDisplayMatch extends Match {
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_member_names: string | null;
  team_b_member_names: string | null;
  cards: MatchCard[];
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
    <div className="flex items-stretch gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:snap-none">
      {rounds.map(([round, ms], ri) => (
        <div key={round} className="flex flex-col min-w-[200px] snap-start">
          <p className="text-xs text-white bg-brand-teal-dark font-display font-bold uppercase tracking-wide text-center py-1.5 mb-3 rounded-full">
            {roundName(round)}
          </p>
          <div className="flex-1 flex flex-col justify-center" style={{ gap: `${Math.pow(2, ri) * 1.1}rem` }}>
            {ms.map((m) => {
              const decided = m.status === "completed";
              return (
                <div
                  key={m.id}
                  className={`panel-card rounded-xl p-3.5 space-y-2 border-l-4 transition-colors duration-300 panel-enter ${
                    decided ? "border-brand-green" : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  <TeamLine
                    name={m.team_a_name}
                    memberNames={m.team_a_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_a_id}
                    score={m.score_a}
                    cardSummary={cardsByTeam(m.cards, m.team_a_id, m.team_b_id).a}
                  />
                  <TeamLine
                    name={m.team_b_name}
                    memberNames={m.team_b_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_b_id}
                    score={m.score_b}
                    cardSummary={cardsByTeam(m.cards, m.team_a_id, m.team_b_id).b}
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

function TeamLine({
  name,
  memberNames,
  won,
  score,
  cardSummary,
}: {
  name: string | null;
  memberNames: string | null;
  won: boolean;
  score: number | null;
  cardSummary: ReturnType<typeof cardsByTeam>["a"];
}) {
  return (
    <div
      className={`flex items-start justify-between gap-2 text-sm rounded-lg px-2 py-1 -mx-2 ${
        won ? "font-display font-bold text-brand-green bg-brand-green/10" : "panel-label"
      }`}
    >
      <span className="truncate">
        {won && "🏆 "}
        {name ? <TeamLabel name={name} memberNames={memberNames} /> : "Por definir"}{" "}
        <TeamCardBadges summary={cardSummary} />
      </span>
      {score !== null && <span className="shrink-0 ml-2 tabular-nums">{score}</span>}
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
