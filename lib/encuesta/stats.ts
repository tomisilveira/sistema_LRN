// Resumen de respuestas de la encuesta para la vista admin. Puro (testeable).

import { CHOICE_FIELDS, INT_FIELDS, MULTI_FIELDS, TEXT_FIELDS, optionLabel } from "./questions";

export type EncuestaResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  inscripcion_id: string | null;
  user_agent_tipo: string | null;
  acepta_contacto: boolean;
  email_contacto: string | null;
  como_se_entero: string[] | null;
  interes_propuestas: string[] | null;
} & Record<string, unknown>;

export type Count = { value: string; label: string; n: number };

/** NPS = % de 9–10 menos % de 0–6, redondeado. null si nadie contestó. */
export function computeNps(values: (number | null | undefined)[]): { nps: number | null; n: number; promotores: number; pasivos: number; detractores: number } {
  const v = values.filter((x): x is number => typeof x === "number");
  const promotores = v.filter((x) => x >= 9).length;
  const detractores = v.filter((x) => x <= 6).length;
  const pasivos = v.length - promotores - detractores;
  return {
    nps: v.length ? Math.round(((promotores - detractores) / v.length) * 100) : null,
    n: v.length,
    promotores,
    pasivos,
    detractores,
  };
}

export function average(values: unknown[]): { avg: number | null; n: number } {
  const v = values.filter((x): x is number => typeof x === "number");
  return { avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
}

export function summarize(rows: EncuestaResponse[]) {
  const choices: Record<string, { answered: number; counts: Count[] }> = {};
  for (const key of Object.keys(CHOICE_FIELDS) as (keyof typeof CHOICE_FIELDS)[]) {
    const counts = CHOICE_FIELDS[key].map((value) => ({
      value,
      label: optionLabel(key, value),
      n: rows.filter((r) => r[key] === value).length,
    }));
    choices[key] = { answered: counts.reduce((a, c) => a + c.n, 0), counts };
  }

  const multis: Record<string, { answered: number; counts: Count[] }> = {};
  for (const key of Object.keys(MULTI_FIELDS) as (keyof typeof MULTI_FIELDS)[]) {
    const counts = MULTI_FIELDS[key].map((value) => ({
      value,
      label: optionLabel(key, value),
      n: rows.filter((r) => Array.isArray(r[key]) && (r[key] as string[]).includes(value)).length,
    }));
    multis[key] = { answered: rows.filter((r) => Array.isArray(r[key]) && (r[key] as string[]).length > 0).length, counts };
  }

  const scales: Record<string, { counts: Count[]; avg: number | null; n: number }> = {};
  for (const key of Object.keys(INT_FIELDS) as (keyof typeof INT_FIELDS)[]) {
    const [min, max] = INT_FIELDS[key];
    const counts: Count[] = [];
    for (let i = min; i <= max; i++) counts.push({ value: String(i), label: String(i), n: rows.filter((r) => r[key] === i).length });
    scales[key] = { counts, ...average(rows.map((r) => r[key])) };
  }

  const texts: Record<string, { id: string; text: string; created_at: string }[]> = {};
  for (const key of TEXT_FIELDS) {
    texts[key] = rows
      .filter((r) => typeof r[key] === "string" && (r[key] as string).trim() !== "")
      .map((r) => ({ id: r.id, text: r[key] as string, created_at: r.created_at }));
  }

  return {
    total: rows.length,
    conToken: rows.filter((r) => r.inscripcion_id).length,
    mobile: rows.filter((r) => r.user_agent_tipo === "mobile").length,
    aceptanContacto: rows.filter((r) => r.acepta_contacto).length,
    nps: computeNps(rows.map((r) => r.nps as number | null)),
    choices,
    multis,
    scales,
    texts,
  };
}

/** Una celda CSV: entre comillas si hace falta, y neutralizando fórmulas
 * (=, +, -, @) para que Excel no las ejecute al abrir el archivo. */
export function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = Array.isArray(v) ? v.join("; ") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM para que Excel abra el UTF-8 con tildes bien.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
