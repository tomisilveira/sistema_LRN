import { test } from "node:test";
import assert from "node:assert/strict";
import { forfeitResult, forfeitLabel } from "../lib/forfeit-rules";

const futbol = { timer_mode: "periods" as const, rounds_to_win: null };
const sumo = { timer_mode: "rounds" as const, rounds_to_win: 2 };

test("W.O. de uno: fútbol 3–0 para el que se presentó", () => {
  assert.deepEqual(forfeitResult(futbol, "a", "A", "B", false), {
    score_a: 0,
    score_b: 3,
    winner_id: "B",
    round_winner_ids: [],
  });
});

test("W.O. de uno: sumo 2–0 en rounds", () => {
  const r = forfeitResult(sumo, "b", "A", "B", false);
  assert.equal(r.winner_id, "A");
  assert.deepEqual([r.score_a, r.score_b], [2, 0]);
  assert.deepEqual(r.round_winner_ids, ["A", "A"]);
});

test("no se presentó ninguno: 0–0 en grupos, sin marcador ni ganador en la llave", () => {
  assert.deepEqual(forfeitResult(sumo, "both", "A", "B", false), {
    score_a: 0,
    score_b: 0,
    winner_id: null,
    round_winner_ids: [],
  });
  assert.equal(forfeitResult(futbol, "both", "A", "B", true).score_a, null);
});

test("texto del W.O.", () => {
  assert.equal(forfeitLabel("a", "Rayo", "Flecha"), "No se presentó Rayo");
  assert.equal(forfeitLabel("both", "Rayo", "Flecha"), "No se presentó ninguno");
  assert.equal(forfeitLabel(null, "Rayo", "Flecha"), null);
});
