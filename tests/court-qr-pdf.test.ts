import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildCourtQrPdf } from "../lib/court-qr-pdf";

const item = (i: number) => ({
  name: `Mini Sumo Autónomo — Cancha ${i}`,
  url: `https://liga-robotica.neuquen.dev/juez/00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  hex: "#5eb046",
  textHex: "#3f8a2c",
});

test("6 canchas por hoja A4", async () => {
  const bytes = await buildCourtQrPdf("Final Liga Robótica Neuquina - Ruca Che", Array.from({ length: 8 }, (_, i) => item(i + 1)));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  const { width, height } = pdf.getPage(0).getSize();
  assert.equal(Math.round((width / 72) * 25.4), 210);
  assert.equal(Math.round((height / 72) * 25.4), 297);
});

test("emojis o caracteres raros en los nombres no rompen el PDF", async () => {
  const bytes = await buildCourtQrPdf("Evento 🤖 Ñandú", [{ ...item(1), name: "Cancha ⚽ 1" }]);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});
