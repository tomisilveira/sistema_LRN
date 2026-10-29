import { test } from "node:test";
import assert from "node:assert/strict";
import { nationalLeagueTotals, normalizeNationalLeague, parseNationalLeagueForm } from "../lib/national-league";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("formulario: guarda solo las filas con números y descarta las vacías", () => {
  const league = parseNationalLeagueForm(
    form({
      row_label_0: "Fútbol Robótico — Juvenil/Adultos",
      row_teams_0: "8",
      row_robots_0: "20",
      row_participants_0: "24",
      row_label_1: "Mini Sumo — Juvenil/Adultos",
      row_teams_1: "",
      row_label_2: "Seguidor de Línea — Juvenil/Adultos",
      row_participants_2: "6",
      provinces: "5",
      note: "  Clasificatorio al Nacional  ",
    })
  );
  assert.deepEqual(league, {
    rows: [
      { label: "Fútbol Robótico — Juvenil/Adultos", teams: 8, robots: 20, participants: 24 },
      { label: "Seguidor de Línea — Juvenil/Adultos", teams: null, robots: null, participants: 6 },
    ],
    provinces: 5,
    note: "Clasificatorio al Nacional",
  });
  assert.deepEqual(nationalLeagueTotals(league!), { teams: 8, robots: 20, participants: 30 });
});

test("formulario vacío borra la Liga Nacional; fila con números sin nombre es error", () => {
  assert.equal(parseNationalLeagueForm(form({ row_label_0: "Fútbol", provinces: "" })), null);
  assert.throws(() => parseNationalLeagueForm(form({ row_teams_3: "4" })), /Falta el nombre de la fila 4/);
});

test("lo guardado se lee tolerando datos raros", () => {
  assert.equal(normalizeNationalLeague(null), null);
  assert.equal(normalizeNationalLeague({ rows: [] }), null);
  assert.deepEqual(normalizeNationalLeague({ rows: [{ label: "Mini Sumo", teams: "7", robots: -1 }, { teams: 3 }], note: "" }), {
    rows: [{ label: "Mini Sumo", teams: 7, robots: null, participants: null }],
    provinces: null,
    note: null,
  });
});
