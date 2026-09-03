// Textos explicativos de la inscripción pública — lo que ve quien elige una
// disciplina en el desplegable, antes de anotarse. La organización tuvo
// problemas con gente que se inscribía sin entender a qué torneo estaba
// entrando; este bloque lo aclara. Editar acá si cambia el reglamento.

import { MAX_TEAM_MEMBERS } from "./team-limits";

export interface DisciplineCopy {
  /** Una frase: de qué se trata la disciplina. */
  tagline: string;
  /** Cómo se juega, en un párrafo. */
  how: string;
  /** "un grupo de personas que arma…" — completa la frase "Tu equipo es …". */
  teamIs: string;
  /** Qué tiene que preparar/traer el equipo. */
  need: string[];
}

const NEED_COMMON = [
  "Un mentor o profesor responsable, mayor de edad.",
  `La lista de integrantes (hasta ${MAX_TEAM_MEMBERS}) con nombre y edad.`,
];

const FUTBOL: DisciplineCopy = {
  tagline: "Dos robots por equipo juegan al fútbol en una cancha cerrada.",
  how: "Cada equipo compite con 2 robots titulares y, si quiere, un suplente. Se juega en partidos de todos contra todos y, según el torneo, una fase final. Gana el equipo que mete más goles.",
  teamIs: "un grupo de personas que arma y maneja 2 robots.",
  need: [
    "Nombre del equipo y de los 2 robots titulares.",
    ...NEED_COMMON,
    "Llevar los robots a homologación técnica el día del evento.",
  ],
};

const SUMO_AUTONOMO: DisciplineCopy = {
  tagline: "Un robot que se maneja solo tiene que empujar al rival fuera del círculo.",
  how: "El robot funciona sin control remoto: detecta al rival y lo empuja fuera del dohyo, la plataforma circular. Los combates se juegan al mejor de 3 rounds de 2 minutos. El peso y las medidas van según el reglamento técnico.",
  teamIs: "un grupo de personas que arma y programa 1 robot autónomo.",
  need: [
    "Nombre del robot.",
    ...NEED_COMMON,
    "Llevar el robot a homologación técnica el día del evento (peso y medidas).",
  ],
};

const SUMO_RC: DisciplineCopy = {
  tagline: "Un robot manejado por control remoto tiene que sacar al rival del círculo.",
  how: "Una persona maneja el robot con un control. El objetivo es el mismo que el sumo autónomo: empujar al rival fuera del dohyo. Al mejor de 3 rounds de 2 minutos.",
  teamIs: "un grupo de personas que arma 1 robot y lo maneja con control.",
  need: ["Nombre del robot.", ...NEED_COMMON, "Llevar el robot a homologación técnica el día del evento."],
};

const MINISUMO_AUTONOMO: DisciplineCopy = {
  tagline: "Sumo en versión chica: un robot más liviano, que se maneja solo.",
  how: "Misma idea que el sumo, con robots bastante más chicos y livianos (medidas y peso según el reglamento). Autónomo, sin control. Al mejor de 3 rounds de 2 minutos. Es una buena categoría para dar los primeros pasos en robótica de combate.",
  teamIs: "un grupo de personas que arma y programa 1 robot chico autónomo.",
  need: ["Nombre del robot.", ...NEED_COMMON, "Llevar el robot a homologación técnica el día del evento."],
};

const MINISUMO_RC: DisciplineCopy = {
  tagline: "Mini sumo manejado por control remoto: el más accesible para arrancar.",
  how: "Robot chico y con control. Empujar al rival fuera del círculo, al mejor de 3 rounds de 2 minutos. Ideal si es tu primera competencia: menos programación, más pilotaje.",
  teamIs: "un grupo de personas que arma 1 robot chico y lo maneja con control.",
  need: ["Nombre del robot.", ...NEED_COMMON, "Llevar el robot a homologación técnica el día del evento."],
};

const GENERIC: DisciplineCopy = {
  tagline: "Inscripción de un equipo a este torneo de la Liga.",
  how: "El formato (grupos, llave o ambos) lo define la organización según la cantidad de inscriptos.",
  teamIs: "un grupo de personas que arma y maneja su(s) robot(s).",
  need: [
    "Nombre del equipo o del robot.",
    ...NEED_COMMON,
    "Llevar el/los robot(s) a homologación técnica el día del evento.",
  ],
};

const BY_SLUG: Record<string, DisciplineCopy> = {
  futbol: FUTBOL,
  sumo_autonomo: SUMO_AUTONOMO,
  sumo_rc: SUMO_RC,
  minisumo_autonomo: MINISUMO_AUTONOMO,
  minisumo_rc: MINISUMO_RC,
};

export function disciplineCopy(disciplineSlug: string): DisciplineCopy {
  return BY_SLUG[disciplineSlug] ?? GENERIC;
}

/** Qué implica completar la inscripción — igual para todas las disciplinas,
 * se muestra debajo de la explicación de la disciplina elegida. */
export const REGISTRATION_IMPLIES = [
  "Reservás un lugar en el torneo de esa disciplina y categoría.",
  "El equipo se compromete a presentarse el día de la jornada.",
  "El día del evento se llama a las canchas por el nombre que cargues.",
  "Aceptás las bases y condiciones de la Liga Robótica Neuquina.",
  "Los nombres de los integrantes se usan para la premiación.",
];
