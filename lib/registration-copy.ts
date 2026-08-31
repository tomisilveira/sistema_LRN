// Textos explicativos del formulario de inscripción pública — "a qué te
// inscribís, qué necesitás y qué implica". La organización tuvo problemas
// con gente que se anotaba sin entender qué estaba reservando; este bloque
// lo aclara antes del formulario. Editar acá si cambia el reglamento.

import { MAX_TEAM_MEMBERS } from "./team-limits";

export interface RegistrationCopy {
  /** Una o dos frases: qué es esta competencia. */
  what: string;
  /** Qué tiene que preparar/traer el equipo. */
  need: string[];
  /** Qué implica completar esta inscripción. */
  implies: string[];
}

const FUTBOL: RegistrationCopy = {
  what: "Fútbol robótico: cada equipo compite con 2 robots titulares (y opcionalmente un suplente) en partidos de todos contra todos y, según el formato, una fase final.",
  need: [
    "Nombre del equipo y de sus 2 robots titulares.",
    "Los datos del mentor/profesor responsable (mayor de edad).",
    `La lista de integrantes del equipo (hasta ${MAX_TEAM_MEMBERS} personas) con nombre y edad.`,
    "Presentar los robots a homologación técnica el día del evento.",
  ],
  implies: [
    "Reservás un lugar en el torneo de esta disciplina y categoría.",
    "El equipo se compromete a presentarse el día de la jornada.",
    "Aceptás las bases y condiciones de la Liga Robótica Neuquina.",
    "Los nombres de los integrantes se usan para la premiación — cargá exactamente a quienes van a competir.",
  ],
};

const SUMO: RegistrationCopy = {
  what: "El equipo compite con un (1) robot. Los combates se juegan al mejor de 3 rounds; se avanza por llave / todos contra todos según el formato del torneo.",
  need: [
    "Nombre del robot.",
    "Los datos del mentor/profesor responsable (mayor de edad).",
    `La lista de integrantes del equipo (hasta ${MAX_TEAM_MEMBERS} personas) con nombre y edad.`,
    "Presentar el robot a homologación técnica el día del evento (peso y medidas según reglamento).",
  ],
  implies: [
    "Reservás un lugar en el torneo de esta disciplina y categoría.",
    "El equipo se compromete a presentarse el día de la jornada.",
    "Aceptás las bases y condiciones de la Liga Robótica Neuquina.",
    "Los nombres de los integrantes se usan para la premiación — cargá exactamente a quienes van a competir.",
  ],
};

const GENERIC: RegistrationCopy = {
  what: "Inscripción de un equipo a este torneo. El formato (grupos, llave o ambos) lo define la organización.",
  need: [
    "Nombre del equipo/robot.",
    "Los datos del mentor/profesor responsable (mayor de edad).",
    `La lista de integrantes del equipo (hasta ${MAX_TEAM_MEMBERS} personas) con nombre y edad.`,
    "Presentar el/los robot(s) a homologación técnica el día del evento.",
  ],
  implies: [
    "Reservás un lugar en el torneo de esta disciplina y categoría.",
    "El equipo se compromete a presentarse el día de la jornada.",
    "Aceptás las bases y condiciones de la Liga Robótica Neuquina.",
    "Los nombres de los integrantes se usan para la premiación.",
  ],
};

export function registrationCopy(disciplineSlug: string): RegistrationCopy {
  if (disciplineSlug === "futbol") return FUTBOL;
  if (disciplineSlug.includes("sumo")) return SUMO;
  return GENERIC;
}
