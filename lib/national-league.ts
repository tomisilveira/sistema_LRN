// Liga Nacional: se juega en el mismo evento pero no se maneja con este
// sistema, así que sus números se cargan a mano desde el panel admin
// (pestaña "Liga Nacional" del evento) y se muestran en el locutor. Se
// guardan en events.national_league (jsonb, ver 0021_national_league.sql).

export interface NationalLeagueRow {
  label: string;
  teams: number | null;
  robots: number | null;
  participants: number | null;
}

export interface NationalLeague {
  rows: NationalLeagueRow[];
  provinces: number | null;
  note: string | null;
}

/** Filas con las que arranca el formulario si todavía no se cargó nada:
 * lo que se juega en la Liga Nacional (todo juvenil/adultos). */
export const NATIONAL_LEAGUE_DEFAULT_LABELS = [
  "Fútbol Robótico — Juvenil/Adultos",
  "Mini Sumo — Juvenil/Adultos",
  "Seguidor de Línea — Juvenil/Adultos",
];

/** Filas que muestra el formulario: las cargadas + vacías hasta este total. */
export const NATIONAL_LEAGUE_FORM_ROWS = 5;

function toCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function toText(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

/** Lee lo guardado en la base, tolerando datos incompletos o mal formados.
 * null si no hay nada que mostrar. */
export function normalizeNationalLeague(raw: unknown): NationalLeague | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rows = (Array.isArray(obj.rows) ? obj.rows : [])
    .map((r): NationalLeagueRow | null => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const label = toText(row.label);
      if (!label) return null;
      return { label, teams: toCount(row.teams), robots: toCount(row.robots), participants: toCount(row.participants) };
    })
    .filter((r): r is NationalLeagueRow => r !== null);
  const league = { rows, provinces: toCount(obj.provinces), note: toText(obj.note) };
  return hasNationalLeagueData(league) ? league : null;
}

/** ¿Hay algún número o nota cargada? (si no, el locutor no muestra la sección). */
export function hasNationalLeagueData(league: NationalLeague): boolean {
  return (
    league.rows.some((r) => r.teams !== null || r.robots !== null || r.participants !== null) ||
    league.provinces !== null ||
    league.note !== null
  );
}

/** Arma lo que se guarda a partir del formulario del admin (campos
 * row_label_N, row_teams_N, row_robots_N, row_participants_N, provinces,
 * note). Las filas sin nombre o sin ningún número se descartan; si no queda
 * nada, devuelve null (borra la Liga Nacional del evento). */
export function parseNationalLeagueForm(formData: FormData): NationalLeague | null {
  const rows: NationalLeagueRow[] = [];
  for (let i = 0; i < NATIONAL_LEAGUE_FORM_ROWS; i++) {
    const label = toText(formData.get(`row_label_${i}`));
    const row = {
      label: label ?? "",
      teams: toCount(formData.get(`row_teams_${i}`)),
      robots: toCount(formData.get(`row_robots_${i}`)),
      participants: toCount(formData.get(`row_participants_${i}`)),
    };
    const hasNumbers = row.teams !== null || row.robots !== null || row.participants !== null;
    if (!hasNumbers) continue;
    if (!label) throw new Error(`Falta el nombre de la fila ${i + 1} (tiene números cargados).`);
    rows.push(row);
  }
  const league = {
    rows,
    provinces: toCount(formData.get("provinces")),
    note: toText(formData.get("note")),
  };
  return hasNationalLeagueData(league) ? league : null;
}

/** Totales de las filas (null en una columna si ninguna fila la tiene). */
export function nationalLeagueTotals(league: NationalLeague): Omit<NationalLeagueRow, "label"> {
  const sum = (key: "teams" | "robots" | "participants") => {
    const values = league.rows.map((r) => r[key]).filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  return { teams: sum("teams"), robots: sum("robots"), participants: sum("participants") };
}
