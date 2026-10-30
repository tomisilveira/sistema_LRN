// Color por disciplina, usado para diferenciar visualmente canchas y
// torneos (una cancha física suele estar armada para una sola disciplina:
// fútbol, sumo, mini sumo...). El color se asigna por sort_order y no por
// slug, para no tener que tocar este archivo si se agrega una disciplina
// nueva al seed — simplemente rota a la próxima posición de la paleta.
import type { Discipline } from "./database.types";

export interface DisciplineColorSet {
  /** Fondo suave para cards/cuadros. */
  bg: string;
  /** Acento de borde izquierdo. */
  border: string;
  /** Texto/ícono sobre el fondo suave. */
  text: string;
  /** Punto de color para chips chicos. */
  dot: string;
  /** Mismo color en hex, para lo que no usa clases de Tailwind (ej. el PDF
   * de QR de canchas). Mantener en sync con --color-brand-* de globals.css. */
  hex: string;
  /** Hex para texto sobre fondo blanco (el teal claro no se lee impreso). */
  textHex: string;
}

const PALETTE: DisciplineColorSet[] = [
  {
    bg: "bg-brand-teal/12",
    border: "border-brand-teal",
    text: "text-brand-teal-dark dark:text-brand-teal",
    dot: "bg-brand-teal",
    hex: "#09aeb5",
    textHex: "#134853",
  },
  {
    bg: "bg-brand-orange/12",
    border: "border-brand-orange",
    text: "text-brand-orange",
    dot: "bg-brand-orange",
    hex: "#f99f1b",
    textHex: "#c97a06",
  },
  {
    bg: "bg-brand-pink/12",
    border: "border-brand-pink",
    text: "text-brand-pink",
    dot: "bg-brand-pink",
    hex: "#ec008c",
    textHex: "#ec008c",
  },
  {
    bg: "bg-brand-green/12",
    border: "border-brand-green",
    text: "text-brand-green",
    dot: "bg-brand-green",
    hex: "#5eb046",
    textHex: "#3f8a2c",
  },
  {
    bg: "bg-brand-violet/12",
    border: "border-brand-violet",
    text: "text-brand-violet",
    dot: "bg-brand-violet",
    hex: "#8b5cf6",
    textHex: "#7c3aed",
  },
  {
    bg: "bg-brand-blue/12",
    border: "border-brand-blue",
    text: "text-brand-blue",
    dot: "bg-brand-blue",
    hex: "#2f6fdf",
    textHex: "#2f6fdf",
  },
];

const UNASSIGNED: DisciplineColorSet = {
  bg: "bg-neutral-100 dark:bg-neutral-900",
  border: "border-neutral-300 dark:border-neutral-700",
  text: "text-neutral-500 dark:text-neutral-500",
  dot: "bg-neutral-400",
  hex: "#a3a3a3",
  textHex: "#525252",
};

export function disciplineColor(
  discipline: Pick<Discipline, "sort_order"> | null | undefined
): DisciplineColorSet {
  if (!discipline) return UNASSIGNED;
  const i = ((discipline.sort_order - 1) % PALETTE.length + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}
