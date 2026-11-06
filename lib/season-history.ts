// Números de temporadas que NO se jugaron con este sistema (2025 se manejó
// en planillas): se cargan a mano acá y la portada los compara con la
// temporada actual, que sí sale de la base (ver lib/season-stats.ts).
//
// Un dato en `null` = no lo tenemos: esa comparación simplemente no se
// muestra (nunca se inventa un número). Para sumar una temporada vieja más,
// agregar otro objeto al array.

export interface ManualSeason {
  year: number;
  /** Encuentros/jornadas de la temporada (regionales + final). */
  events: number | null;
  /** Equipos inscriptos, sumando todos los encuentros. */
  teams: number | null;
  /** Participantes (chicos/as en cancha), sumando todos los encuentros. */
  participants: number | null;
  robots: number | null;
  /** Escuelas/instituciones distintas en toda la temporada. */
  institutions: number | null;
  /** Localidades distintas en toda la temporada. */
  localities: number | null;
  /** Partidos jugados en toda la temporada. */
  matches: number | null;
}

export const MANUAL_SEASONS: ManualSeason[] = [
  {
    year: 2025,
    // Fuente: "Informe Ejecutivo Liga Robótica Neuquina 2025" (ANIDE).
    // Regionales en Neuquén capital y San Martín de los Andes (70 robots,
    // "más de 110" jóvenes) + Encuentro Final en el Ruca Che el 8/11
    // (150 robots, 270 participantes, +600 asistentes). El informe no trae
    // equipos, instituciones, localidades ni partidos.
    events: 3,
    teams: null,
    participants: 110 + 270,
    robots: 70 + 150,
    institutions: null,
    localities: null,
    matches: null,
  },
];
