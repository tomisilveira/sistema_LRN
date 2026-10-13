import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchOutcome } from "../lib/match-logic";

const base = { allowDraws: false, teamAId: "a", teamBId: "b", scoreA: null, scoreB: null };

test("gana el de mayor marcador", () => {
  assert.equal(computeMatchOutcome({ ...base, scoreA: 3, scoreB: 1 }).winner_id, "a");
  assert.equal(computeMatchOutcome({ ...base, scoreA: 0, scoreB: 2 }).winner_id, "b");
});

test("empate: solo si la disciplina lo permite", () => {
  assert.throws(() => computeMatchOutcome({ ...base, scoreA: 1, scoreB: 1 }), /no admite empates/);
  assert.equal(computeMatchOutcome({ ...base, allowDraws: true, scoreA: 1, scoreB: 1 }).winner_id, null);
});

test("sin marcador (sumo): ganador elegido, y tiene que ser de este partido", () => {
  assert.equal(computeMatchOutcome({ ...base, winnerIdIfNoScore: "b" }).winner_id, "b");
  assert.throws(() => computeMatchOutcome({ ...base, winnerIdIfNoScore: "otro" }), /no pertenece/);
});

test("marcador incompleto o negativo: error", () => {
  assert.throws(() => computeMatchOutcome({ ...base, scoreA: 1 }), /Falta/);
  assert.throws(() => computeMatchOutcome({ ...base, scoreA: -1, scoreB: 0 }), /negativo/);
});
