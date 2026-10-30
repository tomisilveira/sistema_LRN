"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { DisciplineColorSet } from "@/lib/discipline-colors";

export interface CourtQrItem {
  id: string;
  name: string;
  /** Path del juez (/juez/<token>); el origen se completa en el navegador. */
  path: string;
  colors: DisciplineColorSet;
  sortKey: number;
}

const PER_PAGE = 6;

/** Las tarjetas QR, de a 6 por hoja A4 (2 columnas × 3 filas). El QR se
 * genera en el navegador (librería `qrcode`, SVG): el link del juez nunca
 * sale a un servicio externo. El origen es el del panel abierto, así que
 * imprimir desde el sitio real da links del sitio real. */
export function CourtQrSheet({ eventName, items }: { eventName: string; items: CourtQrItem[] }) {
  // Origen + QR juntos, cuando terminan de generarse (un solo setState).
  const [generated, setGenerated] = useState<{ origin: string; svgs: Record<string, string> } | null>(null);
  const origin = generated?.origin ?? null;
  const svgs = generated?.svgs ?? {};

  useEffect(() => {
    const o = window.location.origin;
    let cancelled = false;
    Promise.all(
      items.map(async (it) => [it.id, await QRCode.toString(`${o}${it.path}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })] as const)
    ).then((pairs) => {
      if (!cancelled) setGenerated({ origin: o, svgs: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

  /** PDF armado en el navegador (lib/court-qr-pdf.ts, cargado recién al
   * tocar el botón para no sumar peso a la página). */
  async function downloadPdf() {
    if (!origin) return;
    setPdfState("working");
    try {
      const { buildCourtQrPdf } = await import("@/lib/court-qr-pdf");
      const bytes = await buildCourtQrPdf(
        eventName,
        items.map((it) => ({ name: it.name, url: `${origin}${it.path}`, hex: it.colors.hex, textHex: it.colors.textHex }))
      );
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `qr-canchas-${eventName.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setPdfState("idle");
    } catch {
      setPdfState("error");
    }
  }

  const pages: CourtQrItem[][] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
  const ready = items.length > 0 && Object.keys(svgs).length === items.length;

  return (
    <>
      {/* A4 vertical, márgenes chicos; fondo y colores de disciplina sí se
          imprimen (print-color-adjust). */}
      <style>{`@page { size: A4 portrait; margin: 8mm; }
        @media print { .qr-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="print:hidden panel-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold">QR de canchas — {eventName}</h1>
          <p className="text-sm panel-label">
            {items.length} {items.length === 1 ? "cancha" : "canchas"} · {pages.length} {pages.length === 1 ? "hoja" : "hojas"} A4 (6 por hoja). Cada
            QR abre la pantalla del juez de esa cancha: no lo dejes a la vista del público.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdfState === "error" && <span className="text-sm text-red-500">No se pudo armar el PDF. Probá de nuevo.</span>}
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!ready || pdfState === "working"}
            className="rounded-lg panel-button-primary font-display font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {pdfState === "working" ? "Armando PDF…" : "⬇️ Descargar PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!ready}
            className="rounded-lg panel-button-secondary font-display font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {ready ? "🖨️ Imprimir" : "Generando QR…"}
          </button>
        </div>
      </div>

      {items.length === 0 && <p className="text-sm panel-label">Este evento todavía no tiene canchas.</p>}

      <div className="qr-sheet space-y-6 print:space-y-0">
        {pages.map((page, p) => (
          <div
            key={p}
            // Una hoja: en pantalla se ve como papel; al imprimir, salto de
            // página después de cada una menos la última.
            className={`mx-auto bg-white text-neutral-900 shadow print:shadow-none grid grid-cols-2 grid-rows-3 gap-[4mm] p-[4mm] print:p-0 w-[194mm] h-[281mm] ${
              p < pages.length - 1 ? "break-after-page" : ""
            }`}
          >
            {page.map((it) => (
              <div
                key={it.id}
                className={`rounded-xl border border-l-[6px] ${it.colors.border} flex flex-col items-center justify-between text-center p-[4mm] overflow-hidden`}
              >
                <div className="w-full">
                  <p className="text-[9pt] text-neutral-500 truncate">{eventName}</p>
                  <p className={`font-display font-bold text-[15pt] leading-tight ${it.colors.text}`}>{it.name}</p>
                </div>
                {svgs[it.id] ? (
                  <div
                    className="w-[52mm] h-[52mm] [&>svg]:w-full [&>svg]:h-full"
                    // SVG generado acá mismo por `qrcode` a partir del link.
                    dangerouslySetInnerHTML={{ __html: svgs[it.id] }}
                  />
                ) : (
                  <div className="w-[52mm] h-[52mm] bg-neutral-100 animate-pulse rounded" />
                )}
                <div className="w-full">
                  <p className="text-[10pt] font-semibold">📱 Pantalla del juez</p>
                  <p className="text-[6.5pt] text-neutral-500 break-all leading-snug">{origin ? `${origin}${it.path}` : it.path}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
