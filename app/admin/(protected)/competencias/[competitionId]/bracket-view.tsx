import type { Match, MatchCard } from "@/lib/database.types";
import { submitResult } from "./actions";
import { TeamLabel } from "@/app/components/team-label";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";

export interface BracketDisplayMatch extends Match {
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_member_names: string | null;
  team_b_member_names: string | null;
  cards: MatchCard[];
}

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F"];

export function BracketView({
  competitionId,
  matches,
}: {
  competitionId: string;
  matches: BracketDisplayMatch[];
}) {
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

  const submit = submitResult.bind(null, competitionId);

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
      {rounds.map(([round, ms], ri) => (
        <div key={round} className="flex flex-col min-w-[230px]">
          <p className="text-xs text-brand-teal-dark dark:text-brand-teal font-semibold uppercase tracking-wide text-center pb-2 mb-2 border-b-2 border-brand-teal/30">
            {roundName(round)}
          </p>
          <div
            className="flex-1 flex flex-col justify-center"
            style={{ gap: `${Math.pow(2, ri) * 1.1}rem` }}
          >
            {ms.map((m) => {
              const decided = m.status === "completed";
              return (
                <div
                  key={m.id}
                  className={`rounded-xl panel-card p-3 space-y-2 border-l-4 transition-colors duration-300 panel-enter ${
                    decided ? "border-brand-green" : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  <TeamLine
                    name={m.team_a_name}
                    memberNames={m.team_a_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_a_id}
                    score={m.score_a}
                    cardSummary={m.team_a_id ? cardsByTeam(m.cards, m.team_a_id, m.team_b_id).a : null}
                  />
                  <TeamLine
                    name={m.team_b_name}
                    memberNames={m.team_b_member_names}
                    won={m.winner_id !== null && m.winner_id === m.team_b_id}
                    score={m.score_b}
                    cardSummary={m.team_b_id ? cardsByTeam(m.cards, m.team_a_id, m.team_b_id).b : null}
                  />
                  {decided ? (
                    <p className="text-[10px] panel-label">✅ Jugado</p>
                  ) : m.team_a_name && m.team_b_name ? (
                    <form action={submit.bind(null, m.id)} className="flex flex-col gap-1.5 pt-1">
                      <div className="flex gap-1">
                        <input
                          name="score_a"
                          type="number"
                          placeholder="A"
                          className="w-full rounded panel-input px-1.5 py-1 text-xs"
                        />
                        <input
                          name="score_b"
                          type="number"
                          placeholder="B"
                          className="w-full rounded panel-input px-1.5 py-1 text-xs"
                        />
                      </div>
                      <select
                        name="winner_id"
                        className="w-full rounded panel-input px-1.5 py-1 text-xs"
                        defaultValue=""
                      >
                        <option value="">(o elegir ganador directo)</option>
                        <option value={m.team_a_id ?? ""}>{m.team_a_name}</option>
                        <option value={m.team_b_id ?? ""}>{m.team_b_name}</option>
                      </select>
                      <button
                        type="submit"
                        className="text-xs rounded panel-button-primary py-1 font-medium transition-colors"
                      >
                        Guardar resultado
                      </button>
                    </form>
                  ) : (
                    <p className="text-[10px] panel-label opacity-70">Esperando clasificados</p>
                  )}
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
  cardSummary?: ReturnType<typeof cardsByTeam>["a"];
}) {
  return (
    <div className={`flex items-start justify-between gap-2 text-sm ${won ? "font-semibold text-brand-green" : "panel-label"}`}>
      <span className="truncate">
        {won && "🏆 "}
        {name ? <TeamLabel name={name} memberNames={memberNames} /> : "Por definir"}{" "}
        <TeamCardBadges summary={cardSummary} />
      </span>
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
