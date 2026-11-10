// Lee data/ediciones.json (los números de cada edición de la Liga que se
// muestran en la portada) y los deja tipados y listos para comparar. El
// JSON se edita a mano: nada de esto consulta la base.
import raw from "@/data/ediciones.json";

export interface Instancia {
  nombre: string;
  detalle?: string;
  participantes: number | null;
  robots: number | null;
}

export interface Edicion {
  anio: number;
  fuente?: string;
  encuentros: number | null;
  equipos: number | null;
  participantes: number | null;
  robots: number | null;
  instituciones: number | null;
  localidades: number | null;
  partidos: number | null;
  goles: number | null;
  instancias: Instancia[];
  sedes: { nombre: string; fecha?: string; equipos: number | null; participantes: number | null; robots: number | null }[];
  disciplinas: { nombre: string; equipos: number }[];
  localidadesTop: { nombre: string; participantes: number }[];
}

export type MetricKey = "encuentros" | "equipos" | "participantes" | "robots" | "instituciones" | "localidades" | "partidos";

export const METRICS: { key: MetricKey; label: string; note: string }[] = [
  { key: "participantes", label: "Participantes", note: "chicas y chicos en cancha, sumando todas las fechas" },
  { key: "robots", label: "Robots", note: "inscriptos en todas las disciplinas" },
  { key: "equipos", label: "Equipos", note: "inscripciones de la temporada" },
  { key: "encuentros", label: "Encuentros", note: "regionales y final" },
  { key: "instituciones", label: "Instituciones", note: "escuelas y clubes distintos" },
  { key: "localidades", label: "Localidades", note: "de Neuquén y Río Negro" },
  { key: "partidos", label: "Partidos", note: "jugados de punta a punta" },
];

// Color fijo por disciplina, mismo orden que lib/discipline-colors.ts
// (sort_order de la base), para que cada una se vea igual en todo el sitio.
const DISCIPLINE_HEX: [RegExp, string][] = [
  [/f[uú]tbol/i, "#09aeb5"],
  [/^mini\s*sumo.*(rc|radio)/i, "#8b5cf6"],
  [/^mini\s*sumo/i, "#5eb046"],
  [/^sumo.*(rc|radio)/i, "#ec008c"],
  [/^sumo/i, "#f99f1b"],
  [/seguidor/i, "#2f6fdf"],
];

export function disciplineHex(nombre: string): string {
  return DISCIPLINE_HEX.find(([re]) => re.test(nombre))?.[1] ?? "#64748b";
}

export interface EdicionesData {
  actual: Edicion;
  anterior: Edicion | null;
  todas: Edicion[];
}

export function getEdiciones(): EdicionesData | null {
  const todas = ([...(raw.ediciones as Edicion[])]).sort((a, b) => a.anio - b.anio);
  const i = todas.findIndex((e) => e.anio === raw.actual);
  if (i === -1) return null;
  return { actual: todas[i], anterior: i > 0 ? todas[i - 1] : null, todas };
}

/** % de crecimiento entre dos valores, o null si falta alguno. */
export function growth(prev: number | null | undefined, now: number | null | undefined): number | null {
  if (prev == null || now == null || prev <= 0) return null;
  return Math.round(((now - prev) / prev) * 100);
}
