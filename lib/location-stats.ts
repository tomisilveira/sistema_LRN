// "¿De dónde vienen?": equipos y participantes por localidad, para el
// Resumen del evento y la hoja "Localidades" del Excel. Lógica pura, sin DB.
import type { Team } from "./database.types";
import { teamParticipants, type StatsTeam } from "./event-stats";

export type LocationTeam = StatsTeam & Pick<Team, "name">;

export interface LocationRow {
  locality: string;
  province: string | null;
  teams: number;
  participants: number;
}

export interface LocationBreakdown {
  /** Localidades ordenadas por participantes (y equipos) de mayor a menor. */
  rows: LocationRow[];
  /** Equipos sin localidad cargada (inscriptos antes de pedirla, o cargados
   * a mano sin el dato): para completarlos desde la tarjeta del equipo. */
  missing: LocationTeam[];
}

function key(s: string): string {
  return s.trim().toLowerCase();
}

export function computeLocationBreakdown(teams: LocationTeam[]): LocationBreakdown {
  const byKey = new Map<string, LocationRow>();
  const missing: LocationTeam[] = [];
  for (const t of teams) {
    const locality = t.locality?.trim();
    if (!locality) {
      missing.push(t);
      continue;
    }
    const province = t.province?.trim() || null;
    // Misma localidad escrita distinto (mayúsculas/espacios) cuenta junta;
    // se muestra como la escribió el primero.
    const k = `${key(province ?? "")}|${key(locality)}`;
    let row = byKey.get(k);
    if (!row) {
      row = { locality, province, teams: 0, participants: 0 };
      byKey.set(k, row);
    }
    row.teams++;
    row.participants += teamParticipants(t);
  }
  const rows = [...byKey.values()].sort(
    (a, b) =>
      b.participants - a.participants || b.teams - a.teams || a.locality.localeCompare(b.locality, "es")
  );
  return { rows, missing };
}
