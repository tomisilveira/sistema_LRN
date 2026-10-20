import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeTrialRanking, formatRunTime, parseRunTime } from "../lib/time-trial";
import type { Team, TimeTrialRun } from "../lib/database.types";

const team = (id: string): Team => ({ id, name: id.toUpperCase() }) as unknown as Team;
let n = 0;
const run = (team_id: string, attempt: number, time_ms: number | null): TimeTrialRun =>
  ({ id: `r${n++}`, team_id, attempt, time_ms, finished: time_ms !== null }) as TimeTrialRun;

test("ranking por mejor tiempo; desempata el segundo mejor; sin tiempo al final", () => {
  const rows = buildTimeTrialRanking(
    ["a", "b", "c", "d"].map(team),
    [
      run("a", 1, 12000),
      run("a", 2, 15000),
      run("b", 1, 12000),
      run("b", 2, 13000), // mismo mejor que A, mejor segundo → antes
      run("c", 1, 11000),
      run("d", 1, null), // no terminó
    ]
  );
  assert.deepEqual(
    rows.map((r) => [r.team.id, r.position, r.bestMs]),
    [
      ["c", 1, 11000],
      ["b", 2, 12000],
      ["a", 3, 12000],
      ["d", null, null],
    ]
  );
});

test("empate exacto comparte puesto", () => {
  const rows = buildTimeTrialRanking(["a", "b", "c"].map(team), [run("a", 1, 10000), run("b", 1, 10000), run("c", 1, 11000)]);
  assert.deepEqual(rows.map((r) => r.position), [1, 1, 3]);
});

test("formatRunTime y parseRunTime", () => {
  assert.equal(formatRunTime(9870), "9.87");
  assert.equal(formatRunTime(83456), "1:23.46");
  assert.equal(formatRunTime(null), "—");
  assert.equal(parseRunTime("1:23.45"), 83450);
  assert.equal(parseRunTime("83,45"), 83450);
  assert.equal(parseRunTime("12"), 12000);
  assert.equal(parseRunTime("1:75"), null);
  assert.equal(parseRunTime("abc"), null);
  assert.equal(parseRunTime("0"), null);
});
