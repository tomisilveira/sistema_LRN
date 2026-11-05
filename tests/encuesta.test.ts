import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEncuesta, userAgentTipo } from "../lib/encuesta/validate";
import { computeNps, csvCell, summarize, type EncuestaResponse } from "../lib/encuesta/stats";
import { react } from "../lib/encuesta/questions";

const RID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";

test("encuesta: quien_responde es obligatorio y se valida", () => {
  assert.equal(validateEncuesta({ respondent_id: RID }).ok, false);
  assert.equal(validateEncuesta({ respondent_id: RID, quien_responde: "abuela" }).ok, false);
  assert.equal(validateEncuesta({ respondent_id: RID, quien_responde: "padres" }).ok, true);
});

test("encuesta: respondent_id tiene que ser un uuid", () => {
  assert.equal(validateEncuesta({ respondent_id: "1", quien_responde: "padres" }).ok, false);
});

test("encuesta: valores fuera de rango o desconocidos se descartan", () => {
  const r = validateEncuesta({
    respondent_id: RID, quien_responde: "mayor",
    experiencia: 7, nps: 10, puntaje_comodidad: 0, puntaje_esperas: 3.5,
    primera_vez: "2024", horas_total: ">6",
    como_se_entero: ["redes", "tiktok", "redes", "escuela"],
    interes_propuestas: "ia",
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.row.experiencia, null);
  assert.equal(r.row.nps, 10);
  assert.equal(r.row.puntaje_comodidad, null);
  assert.equal(r.row.puntaje_esperas, null);
  assert.equal(r.row.primera_vez, null);
  assert.equal(r.row.horas_total, ">6");
  assert.deepEqual(r.row.como_se_entero, ["escuela", "redes"]);
  assert.deepEqual(r.row.interes_propuestas, []);
});

test("encuesta: textos de más de 2000 caracteres se rechazan", () => {
  const r = validateEncuesta({ respondent_id: RID, quien_responde: "padres", cambiaria: "a".repeat(2001) });
  assert.equal(r.ok, false);
  const ok = validateEncuesta({ respondent_id: RID, quien_responde: "padres", cambiaria: "  " + "a".repeat(2000) + " " });
  assert.ok(ok.ok);
});

test("encuesta: el mail se guarda solo con el consentimiento marcado", () => {
  const sin = validateEncuesta({ respondent_id: RID, quien_responde: "padres", email_contacto: "a@b.com" });
  assert.ok(sin.ok && sin.row.email_contacto === null && sin.row.acepta_contacto === false);
  const con = validateEncuesta({ respondent_id: RID, quien_responde: "padres", email_contacto: " a@b.com ", acepta_contacto: true });
  assert.ok(con.ok && con.row.email_contacto === "a@b.com");
  const malo = validateEncuesta({ respondent_id: RID, quien_responde: "padres", email_contacto: "nope", acepta_contacto: true });
  assert.equal(malo.ok, false);
});

test("encuesta: NPS = % promotores − % detractores", () => {
  assert.equal(computeNps([]).nps, null);
  assert.equal(computeNps([10, 9, 8, 7, 6, 0]).nps, 0);
  assert.equal(computeNps([10, 10, 10, 5]).nps, 50);
  assert.equal(computeNps([null, 9, undefined]).nps, 100);
});

test("encuesta: resumen cuenta opciones y promedia puntajes", () => {
  const base = { created_at: "2026-11-05", updated_at: "2026-11-05", inscripcion_id: null, user_agent_tipo: "mobile", acepta_contacto: false, email_contacto: null };
  const rows = [
    { ...base, id: "1", quien_responde: "padres", experiencia: 5, como_se_entero: ["redes"], interes_propuestas: [] },
    { ...base, id: "2", quien_responde: "padres", experiencia: 3, como_se_entero: ["redes", "escuela"], interes_propuestas: ["ia"], que_conto: "Genial" },
  ] as unknown as EncuestaResponse[];
  const s = summarize(rows);
  assert.equal(s.total, 2);
  assert.equal(s.choices.quien_responde.counts.find((c) => c.value === "padres")?.n, 2);
  assert.equal(s.multis.como_se_entero.counts.find((c) => c.value === "redes")?.n, 2);
  assert.equal(s.scales.experiencia.avg, 4);
  assert.equal(s.texts.que_conto.length, 1);
});

test("encuesta: CSV escapa comillas y neutraliza fórmulas", () => {
  assert.equal(csvCell('dijo "hola", chau'), '"dijo ""hola"", chau"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(["a", "b"]), '"a; b"');
  assert.equal(csvCell(null), "");
});

test("encuesta: reacciones del robot", () => {
  assert.deepEqual(react("volveria_2027", "si", 0), ["festejo", "¡Sííí! Te esperamos en la 3ª edición."]);
  assert.equal(react("nps", 9, 0)[0], "festejo");
  assert.equal(react("nps", 7, 0)[0], "feliz");
  assert.equal(react("nps", 6, 0)[0], "pensando");
  assert.equal(react("experiencia", 1, 0)[0], "triste");
  assert.equal(react("acepta_contacto", true, 0)[0], "feliz");
  assert.deepEqual(react("primera_vez", "primera", 1), ["curioso", "¡Bip! Guardado."]);
});

test("encuesta: tipo de dispositivo", () => {
  assert.equal(userAgentTipo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "mobile");
  assert.equal(userAgentTipo("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
  assert.equal(userAgentTipo(null), "desktop");
});
