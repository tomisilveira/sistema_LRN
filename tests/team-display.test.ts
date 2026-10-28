import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMentorContact } from "../lib/team-display";

test("formato actual: celular · email", () => {
  const c = parseMentorContact("299 155-1234 · profe@escuela.edu.ar");
  assert.deepEqual(c.phones, [{ label: "299 155-1234", href: "tel:2991551234" }]);
  assert.deepEqual(c.emails, ["profe@escuela.edu.ar"]);
  assert.deepEqual(c.other, []);
});

test("formatos viejos: otros separadores, + internacional, un solo dato", () => {
  assert.deepEqual(parseMentorContact("+54 9 299 555 0000, a@b.com").phones[0].href, "tel:+5492995550000");
  assert.deepEqual(parseMentorContact("solo@mail.com").emails, ["solo@mail.com"]);
  assert.deepEqual(parseMentorContact("ver con la escuela").other, ["ver con la escuela"]);
  assert.deepEqual(parseMentorContact(null), { phones: [], emails: [], other: [] });
});
