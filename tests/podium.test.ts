import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPodium } from "../lib/podium";
import type { Group, GroupStandingRow, Match, Team } from "../lib/database.types";

const team = (id: string): Team => ({ id, name: id.toUpperCase(), member_names: null }) as unknown as Team;
const match = (m: Partial<Match>): Match =>
  ({ phase: "bracket", bracket_type: null, status: "completed", team_a_id: null, team_b_id: null, winner_id: null, ...m }) as Match;
const row = (team_id: string): GroupStandingRow => ({ team_id, team_name: team_id.toUpperCase() }) as GroupStandingRow;
const group = { id: "g1", name: "Grupo A" } as Group;

const positions = (entries: { position: number; team: Team }[]) => entries.map((e) => [e.position, e.team.id]);

test("cuadro de 3: semi con pase directo, 3º sin rival y final", () => {
  const [board] = buildPodium({
    competition: { format_type: "single_elimination", status: "finished" },
    teams: ["a", "b", "c"].map(team),
    groups: [],
    standingsByGroup: [],
    bracketMatches: [
      match({ id: "sf1", round: "SF", team_a_id: "a", winner_id: "a" }), // pase directo
      match({ id: "sf2", round: "SF", team_a_id: "b", team_b_id: "c", winner_id: "b" }),
      match({ id: "3p", round: "3P", team_a_id: "c", winner_id: "c" }), // sin rival
      match({ id: "f", round: "F", team_a_id: "a", team_b_id: "b", winner_id: "a" }),
    ],
  });
  assert.deepEqual(positions(board.entries), [
    [1, "a"],
    [2, "b"],
    [3, "c"],
  ]);
});

test("cuadro de solo final con un grupo: el 3º sale de la tabla", () => {
  const [board] = buildPodium({
    competition: { format_type: "single_elimination", status: "finished" },
    teams: ["a", "b", "c"].map(team),
    groups: [group],
    standingsByGroup: [{ group, rows: ["a", "b", "c"].map(row) }],
    bracketMatches: [match({ id: "f", round: "F", team_a_id: "a", team_b_id: "b", winner_id: "b" })],
  });
  assert.deepEqual(positions(board.entries), [
    [1, "b"],
    [2, "a"],
    [3, "c"],
  ]);
});

test("final sin jugar: sin podio y con aviso", () => {
  const [board] = buildPodium({
    competition: { format_type: "single_elimination", status: "bracket_in_progress" },
    teams: ["a", "b"].map(team),
    groups: [],
    standingsByGroup: [],
    bracketMatches: [match({ id: "f", round: "F", status: "scheduled", team_a_id: "a", team_b_id: "b" })],
  });
  assert.equal(board.entries.length, 0);
  assert.match(board.note ?? "", /final/);
});

test("solo grupos con un grupo: podio desde la tabla", () => {
  const [board] = buildPodium({
    competition: { format_type: "groups_only", status: "finished" },
    teams: ["a", "b", "c", "d"].map(team),
    groups: [group],
    standingsByGroup: [{ group, rows: ["d", "a", "c", "b"].map(row) }],
    bracketMatches: [],
  });
  assert.deepEqual(positions(board.entries), [
    [1, "d"],
    [2, "a"],
    [3, "c"],
  ]);
});

test("solo grupos con varios grupos: un podio por grupo", () => {
  const groupB = { id: "g2", name: "Grupo B" } as Group;
  const boards = buildPodium({
    competition: { format_type: "groups_only", status: "finished" },
    teams: ["a", "b", "c", "d", "e", "f"].map(team),
    groups: [group, groupB],
    standingsByGroup: [
      { group, rows: ["b", "a", "c"].map(row) },
      { group: groupB, rows: ["f", "e", "d"].map(row) },
    ],
    bracketMatches: [],
  });
  assert.deepEqual(
    boards.map((b) => b.label),
    ["Podio — Grupo A", "Podio — Grupo B"]
  );
  assert.deepEqual(positions(boards[1].entries), [
    [1, "f"],
    [2, "e"],
    [3, "d"],
  ]);
});
