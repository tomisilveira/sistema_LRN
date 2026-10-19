// Textos y colores de estado compartidos entre las páginas del panel admin.
import type { Competition } from "./database.types";

export const formatLabel: Record<Competition["format_type"], string> = {
  groups_only: "Solo fase de grupos",
  single_elimination: "Grupos + eliminatoria simple",
  gold_silver: "Grupos + oro/plata",
  bracket_only: "Solo cuadro de eliminación (sin grupos)",
};

export const competitionStatusLabel: Record<Competition["status"], string> = {
  setup: "Armando",
  groups_in_progress: "Grupos en curso",
  groups_done: "Grupos cerrados",
  bracket_in_progress: "Eliminatoria en curso",
  finished: "Terminado",
};

export const competitionStatusChipClass: Record<Competition["status"], string> = {
  setup: "panel-chip",
  groups_in_progress: "panel-chip-brand",
  groups_done: "panel-chip-brand",
  bracket_in_progress: "panel-chip-warning",
  finished: "panel-chip-success",
};

/** Rango de edades de una categoría para mostrar ("De 7 a 12 años",
 * "13 años o más"). null si la categoría no tiene edades cargadas. */
export function categoryAgeLabel(minAge: number | null, maxAge: number | null): string | null {
  if (minAge != null && maxAge != null) return `De ${minAge} a ${maxAge} años`;
  if (minAge != null) return `${minAge} años o más`;
  if (maxAge != null) return `Hasta ${maxAge} años`;
  return null;
}
