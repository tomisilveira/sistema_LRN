import type { Match } from "@/lib/database.types";
import { submitResult } from "./actions";

export interface BracketDisplayMatch extends Match {
  team_a_name: string | null;
  team_b_name: string | null;
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
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map(([round, ms]) => (
        <div key={round} className="flex flex-col justify-around gap-4 min-w-[220px]">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">{roundName(round)}</p>
          {ms.map((m) => (
            <div key={m.id} className="rounded-xl panel-card panel-surface p-3 space-y-2">
              <TeamLine name={m.team_a_name} won={m.winner_id === m.team_a_id} score={m.score_a} />
              <TeamLine name={m.team_b_name} won={m.winner_id === m.team_b_id} score={m.score_b} />
              {m.status === "completed" ? (
                <p className="text-[10px] panel-label">Jugado</p>
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
                  <button type="submit" className="text-xs rounded panel-button-primary py-1 transition-colors">
                    Guardar resultado
                  </button>
                </form>
              ) : (
                <p className="text-[10px] panel-label opacity-70">Esperando clasificados</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamLine({ name, won, score }: { name: string | null; won: boolean; score: number | null }) {
  return (
    <div className={`flex items-center justify-between text-sm ${won ? "font-semibold text-brand-green" : "panel-label"}`}>
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
