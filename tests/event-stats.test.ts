import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEventStats, type StatsMatch, type StatsTeam } from "../lib/event-stats";

const team = (t: Partial<StatsTeam>): StatsTeam =>
  ({
    id: "t",
    competition_id: "futbol",
    institution: null,
    province: null,
    locality: null,
    member_count: null,
    member_names: null,
    robot_names: null,
    participants_present: null,
    accredited: false,
    withdrawn_at: null,
    ...t,
  }) as StatsTeam;
const match = (m: Partial<StatsMatch>): StatsMatch =>
  ({
    competition_id: "futbol",
    status: "scheduled",
    team_a_id: "a",
    team_b_id: "b",
    score_a: null,
    score_b: null,
    forfeit: null,
    ...m,
  }) as StatsMatch;

const competitions = [
  { id: "futbol", discipline_id: "d-futbol", timer_mode: "periods" as const },
  { id: "sumo", discipline_id: "d-sumo", timer_mode: "rounds" as const },
  { id: "linea", discipline_id: "d-linea", timer_mode: "time_trial" as const },
];

test("equipos, robots y participantes", () => {
  const stats = computeEventStats({
    competitions,
    teams: [
      team({ robot_names: "R1\nR2\nR3", member_names: "Ana, Beto", institution: "EPET 8", province: "Neuquén", locality: "Zapala" }),
      team({ competition_id: "sumo", member_count: 4, participants_present: 3, accredited: true, institution: " epet 8 ", province: "Neuquén", locality: "Cutral Có" }),
      team({ competition_id: "sumo", member_names: "Caro", withdrawn_at: "2026-10-01", province: "Río Negro", locality: "Zapala" }),
    ],
    matches: [],
    runs: [],
  });
  assert.equal(stats.teams, 3);
  assert.equal(stats.robots, 3 + 1 + 1);
  assert.equal(stats.participants, 2 + 3 + 1);
  assert.equal(stats.accredited, 1);
  assert.equal(stats.withdrawn, 1);
  assert.equal(stats.institutions, 1);
  assert.equal(stats.provinces, 2);
  assert.equal(stats.localities, 3); // Zapala (NQN) ≠ Zapala (RN)
  const sumo = stats.byDiscipline.find((d) => d.disciplineId === "d-sumo")!;
  assert.deepEqual([sumo.teams, sumo.robots, sumo.participants], [2, 2, 4]);
});

test("partidos: byes fuera, W.O. aparte y goles solo en torneos por tiempo", () => {
  const stats = computeEventStats({
    competitions,
    teams: [],
    matches: [
      match({ status: "completed", score_a: 3, score_b: 1 }),
      match({ status: "in_progress", score_a: 1, score_b: 0 }),
      match({ status: "completed", forfeit: "b", score_a: 3, score_b: 0 }),
      match({ status: "completed", team_b_id: null }), // bye
      match({ status: "pending_teams", team_a_id: null, team_b_id: null }),
      match({ competition_id: "sumo", status: "completed", score_a: 2, score_b: 1 }),
      match({ competition_id: "sumo" }),
    ],
    runs: [{ competition_id: "linea" }, { competition_id: "linea" }],
  });
  assert.equal(stats.total, 6);
  assert.equal(stats.played, 2);
  assert.equal(stats.live, 1);
  assert.equal(stats.forfeits, 1);
  assert.equal(stats.remaining, 2);
  assert.equal(stats.goals, 5);
  assert.equal(stats.runs, 2);
  const futbol = stats.byDiscipline.find((d) => d.disciplineId === "d-futbol")!;
  assert.deepEqual([futbol.played, futbol.total], [1, 4]);
});
