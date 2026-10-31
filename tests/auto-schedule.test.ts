import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoScheduleMatches,
  scheduleGroupMatches,
  bracketStage,
  rebalanceSchedule,
  type RebalanceMatch,
  type ScheduleAssignment,
} from "../lib/auto-schedule";
import { generateRoundRobinPairs, interleaveRounds, roundRobinRounds } from "../lib/round-robin";

function assertNoClashes(assignments: ScheduleAssignment[], teamsOf: (id: string) => (string | null)[]) {
  const teamSlots = new Set<string>();
  const courtSlots = new Set<string>();
  for (const a of assignments) {
    const ck = `${a.courtId}@${a.turno}`;
    assert.ok(!courtSlots.has(ck), `cancha ocupada dos veces: ${ck}`);
    courtSlots.add(ck);
    for (const t of teamsOf(a.matchId)) {
      if (!t) continue;
      const k = `${t}@${a.turno}`;
      assert.ok(!teamSlots.has(k), `equipo en dos partidos a la vez: ${k}`);
      teamSlots.add(k);
    }
  }
}

test("autoScheduleMatches: ningún equipo juega dos partidos en el mismo turno", () => {
  const matches = generateRoundRobinPairs(["a", "b", "c", "d", "e"]).map(([x, y], i) => ({
    id: `m${i}`,
    team_a_id: x,
    team_b_id: y,
  }));
  const res = autoScheduleMatches(matches, [{ id: "C1" }, { id: "C2" }]);
  assert.equal(res.length, matches.length);
  const byId = new Map(matches.map((m) => [m.id, m]));
  assertNoClashes(res, (id) => [byId.get(id)!.team_a_id, byId.get(id)!.team_b_id]);
});

test("autoScheduleMatches: sin canchas no asigna nada", () => {
  assert.deepEqual(autoScheduleMatches([{ id: "m", team_a_id: "a", team_b_id: "b" }], []), []);
});

/** Dos torneos de la misma disciplina: A con 2 grupos de 4 + semis/3P/final,
 * B con 1 grupo de 5 + final. */
function scenario() {
  const ms: RebalanceMatch[] = [];
  let n = 0;
  const group = (comp: string, teams: string[]) => {
    for (const [a, b] of generateRoundRobinPairs(teams)) {
      ms.push({ id: `m${n++}`, team_a_id: a, team_b_id: b, competitionId: comp, chain: `${comp}|`, stage: 0 });
    }
  };
  const bracket = (comp: string, rounds: string[]) => {
    for (const r of rounds) {
      ms.push({
        id: `m${n++}`,
        team_a_id: null,
        team_b_id: null,
        competitionId: comp,
        chain: `${comp}|`,
        stage: bracketStage(r),
      });
    }
  };
  group("A", ["a1", "a2", "a3", "a4"]);
  group("A", ["a5", "a6", "a7", "a8"]);
  bracket("A", ["SF", "SF", "3P", "F"]);
  group("B", ["b1", "b2", "b3", "b4", "b5"]);
  bracket("B", ["F"]);
  return ms;
}

test("rebalanceSchedule: reparte parejo entre canchas y sin choques", () => {
  const ms = scenario();
  const courts = [{ id: "C1" }, { id: "C2" }, { id: "C3" }];
  const res = rebalanceSchedule(ms, courts, 4);
  assert.equal(res.length, ms.length);
  const byId = new Map(ms.map((m) => [m.id, m]));
  assertNoClashes(res, (id) => [byId.get(id)!.team_a_id, byId.get(id)!.team_b_id]);
  const loads = courts.map((c) => res.filter((r) => r.courtId === c.id).length);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, `carga despareja: ${loads}`);
  assert.ok(
    res.every((r) => r.turno >= 4),
    "nada antes del turno de inicio"
  );
});

test("rebalanceSchedule: el cuadro va después de los grupos y la final al último", () => {
  const ms = scenario();
  const res = rebalanceSchedule(ms, [{ id: "C1" }, { id: "C2" }], 1);
  const turno = new Map(res.map((r) => [r.matchId, r.turno]));
  for (const comp of ["A", "B"]) {
    const of = (pred: (m: RebalanceMatch) => boolean) =>
      ms.filter((m) => m.competitionId === comp && pred(m)).map((m) => turno.get(m.id)!);
    const lastGroup = Math.max(...of((m) => m.stage === 0));
    const firstBracket = Math.min(...of((m) => m.stage > 0));
    assert.ok(firstBracket > lastGroup, `${comp}: el cuadro arranca antes de terminar los grupos`);
    const final = Math.max(...of((m) => m.stage === bracketStage("F")));
    const beforeFinal = of((m) => m.stage > 0 && m.stage < bracketStage("F"));
    assert.ok(
      beforeFinal.every((t) => t < final),
      `${comp}: la final no es lo último`
    );
  }
});

test("rebalanceSchedule: intercala torneos (el segundo no espera al primero)", () => {
  const ms = scenario();
  const compOf = new Map(ms.map((m) => [m.id, m.competitionId]));
  const res = rebalanceSchedule(ms, [{ id: "C1" }, { id: "C2" }], 1);
  const firstTurnoB = Math.min(...res.filter((r) => compOf.get(r.matchId) === "B").map((r) => r.turno));
  assert.equal(firstTurnoB, 1);
});

/** Fase de grupos como la arma "Iniciar torneo": por rondas, intercalando grupos. */
function groupPhase(groups: string[][]) {
  return interleaveRounds(groups.map((g) => roundRobinRounds(g))).map(([a, b], i) => ({
    id: `m${i}`,
    team_a_id: a,
    team_b_id: b,
  }));
}

/** Racha más larga de turnos seguidos que juega un mismo equipo. */
function longestStreak(assignments: ScheduleAssignment[], matches: { id: string; team_a_id: string; team_b_id: string }[]) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const turnos = new Map<string, number[]>();
  for (const a of assignments) {
    const m = byId.get(a.matchId)!;
    for (const t of [m.team_a_id, m.team_b_id]) turnos.set(t, [...(turnos.get(t) ?? []), a.turno]);
  }
  let worst = 0;
  for (const list of turnos.values()) {
    list.sort((x, y) => x - y);
    let streak = 1;
    for (let i = 1; i < list.length; i++) {
      streak = list[i] === list[i - 1] + 1 ? streak + 1 : 1;
      worst = Math.max(worst, streak);
    }
    worst = Math.max(worst, 1);
  }
  return worst;
}

test("scheduleGroupMatches: todos asignados, sin choques ni canchas dobles", () => {
  const groups = [["a1", "a2", "a3", "a4"], ["b1", "b2", "b3", "b4"], ["c1", "c2", "c3", "c4", "c5"]];
  const matches = groupPhase(groups);
  const res = scheduleGroupMatches(matches, [{ id: "C1" }, { id: "C2" }, { id: "C3" }]);
  assert.equal(res.length, matches.length);
  const byId = new Map(matches.map((m) => [m.id, m]));
  assertNoClashes(res, (id) => [byId.get(id)!.team_a_id, byId.get(id)!.team_b_id]);
});

test("scheduleGroupMatches: con grupos de 4 y 3 canchas nadie juega dos turnos seguidos", () => {
  // 8 grupos de 4 = 32 equipos (como fútbol infantil) en 3 canchas.
  const groups = Array.from({ length: 8 }, (_, g) => Array.from({ length: 4 }, (_, i) => `g${g}t${i}`));
  const matches = groupPhase(groups);
  const res = scheduleGroupMatches(matches, [{ id: "C1" }, { id: "C2" }, { id: "C3" }]);
  assert.equal(res.length, 48);
  assert.equal(longestStreak(res, matches), 1);
  // Ninguna cancha queda vacía antes del último turno.
  const lastTurno = Math.max(...res.map((r) => r.turno));
  assert.equal(lastTurno, 16);
});

test("antes: el orden equipo por equipo hacía jugar partidos seguidos", () => {
  const teams = ["a", "b", "c", "d"];
  const oldOrder = generateRoundRobinPairs(teams).map(([x, y], i) => ({ id: `m${i}`, team_a_id: x, team_b_id: y }));
  const old = autoScheduleMatches(oldOrder, [{ id: "C1" }]);
  assert.ok(longestStreak(old, oldOrder) >= 2);
});
