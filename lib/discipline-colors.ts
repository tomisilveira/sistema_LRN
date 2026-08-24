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
}

const PALETTE: DisciplineColorSet[] = [
  {
    bg: "bg-brand-teal/12",
    border: "border-brand-teal",
    text: "text-brand-teal-dark dark:text-brand-teal",
    dot: "bg-brand-teal",
  },
  {
    bg: "bg-brand-orange/12",
    border: "border-brand-orange",
    text: "text-brand-orange",
    dot: "bg-brand-orange",
  },
  {
    bg: "bg-brand-pink/12",
    border: "border-brand-pink",
    text: "text-brand-pink",
    dot: "bg-brand-pink",
  },
  {
    bg: "bg-brand-green/12",
    border: "border-brand-green",
    text: "text-brand-green",
    dot: "bg-brand-green",
  },
  {
    bg: "bg-brand-violet/12",
    border: "border-brand-violet",
    text: "text-brand-violet",
    dot: "bg-brand-violet",
  },
];

const UNASSIGNED: DisciplineColorSet = {
  bg: "bg-neutral-100 dark:bg-neutral-900",
  border: "border-neutral-300 dark:border-neutral-700",
  text: "text-neutral-500 dark:text-neutral-500",
  dot: "bg-neutral-400",
};

export function disciplineColor(
  discipline: Pick<Discipline, "sort_order"> | null | undefined
): DisciplineColorSet {
  if (!discipline) return UNASSIGNED;
  const i = ((discipline.sort_order - 1) % PALETTE.length + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}
