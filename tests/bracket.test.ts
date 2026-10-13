import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeedOrder, generateBracketRounds, type SeedTeam } from "../lib/bracket";

const seeds = (n: number): SeedTeam[] =>
  Array.from({ length: n }, (_, i) => ({ teamId: `s${i + 1}`, teamName: `Semilla ${i + 1}`, seed: i + 1 }));

test("8 equipos: cuartos, semis y final, sin pases directos", () => {
  const rounds = generateBracketRounds(seeds(8));
  assert.deepEqual(
    rounds.map((r) => [r.round, r.matches.length]),
    [
      ["QF", 4],
      ["SF", 2],
      ["F", 1],
    ]
  );
  assert.ok(rounds[0].matches.every((m) => !m.isBye));
  // 1 contra 8 en el primer cruce
  assert.deepEqual([rounds[0].matches[0].teamAId, rounds[0].matches[0].teamBId], ["s1", "s8"]);
});

test("3 equipos: semis de 4 lugares, la mejor semilla pasa directo", () => {
  const [sf, f] = generateBracketRounds(seeds(3));
  assert.equal(sf.round, "SF");
  assert.equal(f.round, "F");
  const byes = sf.matches.filter((m) => m.isBye);
  assert.equal(byes.length, 1);
  assert.equal(byes[0].teamAId ?? byes[0].teamBId, "s1");
});

test("2 equipos: solo final", () => {
  const rounds = generateBracketRounds(seeds(2));
  assert.deepEqual(
    rounds.map((r) => r.round),
    ["F"]
  );
});

test("menos de 2 clasificados: error claro", () => {
  assert.throws(() => generateBracketRounds(seeds(1)), /al menos 2/);
});

test("siembra: primero todos los 1º de grupo, después los 2º", () => {
  const order = buildSeedOrder([
    {
      groupName: "A",
      teams: [
        { teamId: "a1", teamName: "A1", rank: 1 },
        { teamId: "a2", teamName: "A2", rank: 2 },
      ],
    },
    {
      groupName: "B",
      teams: [
        { teamId: "b1", teamName: "B1", rank: 1 },
        { teamId: "b2", teamName: "B2", rank: 2 },
      ],
    },
  ]);
  assert.deepEqual(
    order.map((s) => s.teamId),
    ["a1", "b1", "a2", "b2"]
  );
  assert.deepEqual(
    order.map((s) => s.seed),
    [1, 2, 3, 4]
  );
});
