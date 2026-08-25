import { disciplineDisplayName } from "./discipline-display";

// Nombre de cancha mostrado en el panel/pantalla/juez: "Cancha 1" pasa a
// "Cancha 1 Fútbol Robótico" cuando la cancha tiene una disciplina asignada.
// Se calcula al mostrar (no se guarda en `courts.name`) para que quede
// siempre al día si el admin recolorea la cancha a otra disciplina después
// (ver [[courts-discipline-not-per-torneo]] — discipline_id es reasignable,
// no fijo desde la creación).
export function courtDisplayName(name: string, discipline: { name: string } | null | undefined): string {
  return discipline ? `${name} ${disciplineDisplayName(discipline.name)}` : name;
}
