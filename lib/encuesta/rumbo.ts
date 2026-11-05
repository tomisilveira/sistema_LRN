// "Rumbo a la 3ª edición": datos de la línea de tiempo de la pantalla de
// gracias (y la franja del panel izquierdo en compu). Configurables acá, no
// en el componente. Una estadística con `valor: null` NO se muestra.
//
// PENDIENTE DE CONFIRMAR (SPEC §6): los robots de 2026 son una estimación
// (2 por equipo de fútbol y 1 por equipo de sumo) y la planilla de la Final
// es anterior al evento. `scripts/encuesta-rumbo-stats.ts` calcula robots y
// participaciones reales de los eventos 2026 desde la base, para corregir
// estos números a mano.

export type RumboStat = { valor: number | null; prefijo?: string; label: string };
export type RumboEdicion = {
  anio: number;
  edicion: string;
  texto: string;
  stats?: RumboStat[];
  nota?: string;
  /** La próxima edición (punto naranja que late). */
  proxima?: boolean;
};

/** Año de la edición en curso ("estás acá"). */
export const RUMBO_ACTUAL = 2026;

export const RUMBO: RumboEdicion[] = [
  {
    anio: 2025, edicion: "1ª",
    texto: "2 encuentros regionales, en Confluencia y Lagos del Sur, y la Final en el Ruca Che.",
    stats: [
      { valor: 150, prefijo: "+", label: "robots en la Final" },
      { valor: null, label: "participantes" },
      { valor: null, label: "espectadores" },
    ],
    nota: "Datos de la Final 2025.",
  },
  {
    anio: 2026, edicion: "2ª",
    texto: "3 encuentros regionales, en Chos Malal, Villa La Angostura y Plaza Huincul, y la Final en el Ruca Che. ¡Gracias por estar!",
    stats: [
      { valor: 198, prefijo: "+", label: "robots" },
      { valor: 303, prefijo: "+", label: "participaciones" },
      { valor: 2000, prefijo: "+", label: "espectadores en la Final" },
    ],
    nota: "Robots y participaciones: suma de los 4 encuentros de 2026.",
  },
  { anio: 2027, edicion: "3ª", texto: "La estamos armando con lo que nos contaste. ¡Te esperamos!", proxima: true },
];
