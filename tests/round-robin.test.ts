import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateRoundRobinLegs,
  generateRoundRobinPairs,
  interleaveRounds,
  missingRoundRobinMatches,
  roundRobinLegsOf,
  roundRobinRounds,
} from "../lib/round-robin";

test("todos contra todos: n·(n-1)/2 partidos, sin repetidos ni contra sí mismo", () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const teams = Array.from({ length: n }, (_, i) => `t${i}`);
    const pairs = generateRoundRobinPairs(teams);
    assert.equal(pairs.length, (n * (n - 1)) / 2);
    const keys = new Set(pairs.map(([a, b]) => [a, b].sort().join("-")));
    assert.equal(keys.size, pairs.length);
    assert.ok(pairs.every(([a, b]) => a !== b));
  }
});

test("menos de 2 equipos: sin partidos", () => {
  assert.deepEqual(generateRoundRobinPairs([]), []);
  assert.deepEqual(generateRoundRobinPairs(["solo"]), []);
});

test("por rondas: en cada ronda cada equipo juega como mucho una vez", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    const teams = Array.from({ length: n }, (_, i) => `t${i}`);
    const rounds = roundRobinRounds(teams);
    assert.equal(rounds.length, n % 2 === 0 ? n - 1 : n);
    for (const round of rounds) {
      const seen = round.flat();
      assert.equal(new Set(seen).size, seen.length, `equipo repetido en una ronda (n=${n})`);
    }
    // Siguen siendo todos contra todos, sin repetidos.
    const keys = rounds.flat().map(([a, b]) => [a, b].sort().join("-"));
    assert.equal(keys.length, (n * (n - 1)) / 2);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("varias vueltas: cada par se enfrenta N veces, alternando quién va primero", () => {
  const legs = generateRoundRobinLegs(["a", "b", "c"], 4);
  assert.equal(legs.length, 12);
  const ab = legs.filter(([x, y]) => [x, y].sort().join("") === "ab");
  assert.equal(ab.length, 4);
  for (let i = 1; i < ab.length; i++) assert.deepEqual(ab[i], [ab[i - 1][1], ab[i - 1][0]]);
  assert.equal(generateRoundRobinLegs(["a", "b"], 1).length, 1);
});

test("intercalar grupos: ronda 1 de cada grupo, después ronda 2...", () => {
  assert.deepEqual(interleaveRounds([[["A1"], ["A2"]], [["B1"], ["B2"], ["B3"]]]), ["A1", "B1", "A2", "B2", "B3"]);
});

test("partidos que faltan: completa las vueltas sin duplicar las ya armadas", () => {
  const key = ([a, b]: [string, string]) => [a, b].sort().join("");
  const existing = [
    { team_a_id: "a", team_b_id: "b" },
    { team_a_id: "b", team_b_id: "a" },
    { team_a_id: "a", team_b_id: "c" },
  ];
  const missing = missingRoundRobinMatches(["a", "b", "c"], 2, existing);
  // a-b ya tiene sus 2; a-c le falta 1; b-c le faltan 2.
  assert.deepEqual(missing.map(key).sort(), ["ac", "bc", "bc"]);
  // Equipo nuevo en un torneo de 1 vuelta: solo sus partidos.
  assert.deepEqual(
    missingRoundRobinMatches(["a", "b", "d"], 1, [{ team_a_id: "a", team_b_id: "b" }]).map(key).sort(),
    ["ad", "bd"]
  );
});

test("vueltas configuradas: 1 si no hay dato o es inválido", () => {
  assert.equal(roundRobinLegsOf({}), 1);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 4 }), 4);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 0 }), 1);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 99 }), 6);
});
