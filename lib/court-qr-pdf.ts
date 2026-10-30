// PDF descargable con los QR de las canchas (link del juez), 6 por A4
// (2 × 3) — mismo diseño que la hoja imprimible de
// /admin/eventos/[id]/qr-canchas. Se arma en el navegador con pdf-lib: el
// link del juez (la credencial de la cancha) no sale a ningún servicio
// externo. El QR se dibuja como vectores, así sale nítido a cualquier
// tamaño de impresión.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";

export interface CourtQrPdfItem {
  name: string;
  /** Link completo (origen + /juez/<token>). */
  url: string;
  /** Color de la disciplina (borde) y del nombre de la cancha. */
  hex: string;
  textHex: string;
}

const MM = 72 / 25.4;
const A4 = { w: 210 * MM, h: 297 * MM };
const MARGIN = 8 * MM;
const GAP = 4 * MM;
const COLS = 2;
const ROWS = 3;
export const COURT_QR_PER_PAGE = COLS * ROWS;
const QR_SIZE = 52 * MM;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica estándar solo codifica WinAnsi (español sí, emojis no): lo que
 * no entra se pasa sin tilde o se saca, en vez de romper el PDF. */
function safeText(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      try {
        font.encodeText(plain);
        out += plain;
      } catch {
        // carácter sin equivalente (ej. emoji): se omite
      }
    }
  }
  return out.trim();
}

/** Parte un texto en líneas que entren en `maxWidth` (por palabras; una
 * palabra más larga que el ancho, como un link, se corta por caracteres). */
function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    let rest = word;
    while (!fits(rest)) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number, color: RGB) {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 1; // un módulo de margen blanco alrededor
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    // Tramos seguidos de módulos negros de la fila en un solo rectángulo.
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      page.drawRectangle({
        x: x + (quiet + start) * cell,
        y: y + size - (quiet + r + 1) * cell,
        width: (c - start) * cell,
        height: cell,
        color: rgb(0, 0, 0),
      });
    }
  }
}

export async function buildCourtQrPdf(eventName: string, items: CourtQrPdfItem[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`QR de canchas — ${eventName}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.45, 0.45, 0.45);

  const cardW = (A4.w - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
  const cardH = (A4.h - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;
  const pad = 4 * MM;
  const event = safeText(font, eventName);

  let page: PDFPage | null = null;
  items.forEach((item, i) => {
    const slot = i % COURT_QR_PER_PAGE;
    if (slot === 0) page = pdf.addPage([A4.w, A4.h]);
    const p = page!;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * (cardW + GAP);
    const top = A4.h - MARGIN - row * (cardH + GAP);
    const y = top - cardH;
    const cx = x + cardW / 2;
    const color = hexToRgb(item.hex);

    // Marco fino del color de la disciplina + franja gruesa a la izquierda.
    p.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: color, borderWidth: 1 });
    p.drawRectangle({ x, y, width: 6, height: cardH, color });

    let cursor = top - pad - 8;
    const eventLine = wrap(font, event, 8, cardW - 2 * pad)[0] ?? "";
    drawCentered(p, eventLine, font, 8, cx, cursor, gray);
    cursor -= 18;
    for (const line of wrap(bold, safeText(bold, item.name), 15, cardW - 2 * pad).slice(0, 2)) {
      drawCentered(p, line, bold, 15, cx, cursor, hexToRgb(item.textHex));
      cursor -= 17;
    }

    const urlLines = wrap(font, item.url, 6.5, cardW - 2 * pad).slice(0, 3);
    const bottomBlock = pad + urlLines.length * 8 + 14;
    // QR centrado en el espacio que queda entre el título y el pie.
    const qrY = y + bottomBlock + (cursor - (y + bottomBlock) - QR_SIZE) / 2;
    drawQr(p, item.url, cx - QR_SIZE / 2, qrY, QR_SIZE);

    let footer = y + pad + (urlLines.length - 1) * 8;
    drawCentered(p, "Pantalla del juez", bold, 10, cx, footer + 11, rgb(0.1, 0.1, 0.1));
    for (const line of urlLines) {
      drawCentered(p, line, font, 6.5, cx, footer, gray);
      footer -= 8;
    }
  });

  return pdf.save();
}
