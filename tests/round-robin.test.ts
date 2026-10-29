import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRoundRobinLegs, generateRoundRobinPairs, missingRoundRobinMatches, roundRobinLegsOf } from "../lib/round-robin";

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

test("varias vueltas: cada par se enfrenta N veces, alternando quién va primero", () => {
  const legs = generateRoundRobinLegs(["a", "b", "c"], 4);
  assert.equal(legs.length, 12);
  const ab = legs.filter(([x, y]) => [x, y].sort().join("") === "ab");
  assert.deepEqual(ab, [["a", "b"], ["b", "a"], ["a", "b"], ["b", "a"]]);
  // Vuelta 1 completa antes de la 2: nadie repite rival en partidos seguidos del par.
  assert.deepEqual(legs.slice(0, 3), [["a", "b"], ["a", "c"], ["b", "c"]]);
  assert.deepEqual(generateRoundRobinLegs(["a", "b"], 1), [["a", "b"]]);
});

test("partidos que faltan: completa las vueltas sin duplicar las ya armadas", () => {
  const existing = [
    { team_a_id: "a", team_b_id: "b" },
    { team_a_id: "b", team_b_id: "a" },
    { team_a_id: "a", team_b_id: "c" },
  ];
  const missing = missingRoundRobinMatches(["a", "b", "c"], 2, existing);
  // a-b ya tiene sus 2; a-c le falta la vuelta 2; b-c le faltan las 2.
  assert.deepEqual(missing, [["b", "c"], ["c", "a"], ["c", "b"]]);
  // Equipo nuevo en un torneo de 1 vuelta: solo sus partidos.
  assert.deepEqual(missingRoundRobinMatches(["a", "b", "d"], 1, [{ team_a_id: "a", team_b_id: "b" }]), [["a", "d"], ["b", "d"]]);
});

test("vueltas configuradas: 1 si no hay dato o es inválido", () => {
  assert.equal(roundRobinLegsOf({}), 1);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 4 }), 4);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 0 }), 1);
  assert.equal(roundRobinLegsOf({ round_robin_legs: 99 }), 6);
});
