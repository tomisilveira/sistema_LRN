import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRoundRobinPairs } from "../lib/round-robin";

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
