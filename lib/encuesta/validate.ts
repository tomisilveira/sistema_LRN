// Validación de una respuesta de la encuesta (server). Pura, sin I/O, para
// poder testearla (tests/encuesta.test.ts). Todo lo desconocido o fuera de
// rango se descarta en silencio (las preguntas son opcionales): lo único
// que hace fallar es quién responde, el id del navegador o un texto largo.

import { CHOICE_FIELDS, INT_FIELDS, MAX_TEXT, MULTI_FIELDS, TEXT_FIELDS } from "./questions";

export type EncuestaRow = {
  respondent_id: string;
  quien_responde: string;
  experiencia: number | null;
  experiencia_equipo: number | null;
  que_conto: string | null;
  primera_vez: string | null;
  nps: number | null;
  como_se_entero: string[];
  como_se_entero_otro: string | null;
  conocia_anide: string | null;
  sede_cercana: string | null;
  info_previa: string | null;
  acompanamiento_referente: string | null;
  puntaje_comodidad: number | null;
  puntaje_organizacion: number | null;
  puntaje_seguridad: number | null;
  puntaje_esperas: number | null;
  horas_total: string | null;
  momento_malo: string | null;
  volveria_2027: string | null;
  interes_propuestas: string[];
  acepta_contacto: boolean;
  email_contacto: string | null;
  cambiaria: string | null;
  chico_mas_gusto: string | null;
  chico_menos_gusto: string | null;
};

export type ValidationResult = { ok: true; row: EncuestaRow } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

export function validateEncuesta(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Respuesta inválida." };
  const a = input as Record<string, unknown>;

  const respondentId = typeof a.respondent_id === "string" ? a.respondent_id : "";
  if (!UUID_RE.test(respondentId)) return { ok: false, error: "Respuesta inválida." };

  const quien = a.quien_responde;
  if (typeof quien !== "string" || !(CHOICE_FIELDS.quien_responde as readonly string[]).includes(quien)) {
    return { ok: false, error: "Contanos quién responde la encuesta." };
  }

  const choice = (key: keyof typeof CHOICE_FIELDS): string | null => {
    const v = a[key];
    return typeof v === "string" && (CHOICE_FIELDS[key] as readonly string[]).includes(v) ? v : null;
  };
  const int = (key: keyof typeof INT_FIELDS): number | null => {
    const v = a[key];
    const [min, max] = INT_FIELDS[key];
    return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
  };
  const multi = (key: keyof typeof MULTI_FIELDS): string[] => {
    const v = a[key];
    if (!Array.isArray(v)) return [];
    const allowed = MULTI_FIELDS[key] as readonly string[];
    return allowed.filter((x) => v.includes(x)); // orden canónico, sin duplicados
  };

  const texts: Record<string, string | null> = {};
  for (const key of TEXT_FIELDS) {
    const v = a[key];
    if (v == null || v === "") { texts[key] = null; continue; }
    if (typeof v !== "string") { texts[key] = null; continue; }
    const t = v.trim();
    if (t.length > MAX_TEXT) return { ok: false, error: `Los textos pueden tener hasta ${MAX_TEXT} caracteres.` };
    texts[key] = t || null;
  }

  const acepta = a.acepta_contacto === true;
  let email: string | null = null;
  if (acepta && typeof a.email_contacto === "string") {
    const e = a.email_contacto.trim();
    if (e) {
      if (e.length > 254 || !EMAIL_RE.test(e)) return { ok: false, error: "Revisá el mail de contacto." };
      email = e;
    }
  }

  const comoSeEntero = multi("como_se_entero");
  // Cada público guarda solo lo que se le preguntó (lib/encuesta/questions.ts,
  // questionsFor): si alguien cambió "quién responde" después de completar
  // algo, lo que ya no ve no se guarda. El bloque de chicos y chicas es solo
  // para familias; "cómo vivió la Liga tu equipo", solo para docentes; "¿se
  // sintió acompañado/a por el referente?", para todos menos docentes.
  const sinChicos = quien !== "padres";
  const esDocente = quien === "docente";

  return {
    ok: true,
    row: {
      respondent_id: respondentId.toLowerCase(),
      quien_responde: quien,
      experiencia: int("experiencia"),
      experiencia_equipo: esDocente ? int("experiencia_equipo") : null,
      que_conto: texts.que_conto,
      primera_vez: choice("primera_vez"),
      nps: int("nps"),
      como_se_entero: comoSeEntero,
      // El "¿cuál?" solo vale con "Otro" marcado.
      como_se_entero_otro: comoSeEntero.includes("otro") ? texts.como_se_entero_otro : null,
      conocia_anide: choice("conocia_anide"),
      sede_cercana: choice("sede_cercana"),
      info_previa: choice("info_previa"),
      acompanamiento_referente: esDocente ? null : choice("acompanamiento_referente"),
      puntaje_comodidad: int("puntaje_comodidad"),
      puntaje_organizacion: int("puntaje_organizacion"),
      puntaje_seguridad: int("puntaje_seguridad"),
      puntaje_esperas: int("puntaje_esperas"),
      horas_total: choice("horas_total"),
      momento_malo: texts.momento_malo,
      volveria_2027: choice("volveria_2027"),
      interes_propuestas: multi("interes_propuestas"),
      // El mail se guarda SOLO con el consentimiento marcado.
      acepta_contacto: acepta,
      email_contacto: acepta ? email : null,
      cambiaria: texts.cambiaria,
      chico_mas_gusto: sinChicos ? null : texts.chico_mas_gusto,
      chico_menos_gusto: sinChicos ? null : texts.chico_menos_gusto,
    },
  };
}

/** mobile/desktop a partir del User-Agent (para estadística, nada más). */
export function userAgentTipo(ua: string | null | undefined): "mobile" | "desktop" {
  return ua && /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
}
