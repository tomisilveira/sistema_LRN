// Datos de la política de privacidad (app/privacidad/page.tsx) que la
// organización tiene que confirmar o completar. Todo lo que dice la página
// sobre QUÉ datos se guardan sale del código; esto es lo que el código no
// puede saber.

/** Quién es responsable de los datos (Ley 25.326, art. 2). */
export const PRIVACY_CONTROLLER = "Joaquín Perren";

/** Mail para pedidos de acceso, corrección o baja de datos y reclamos de
 * privacidad. null = la página muestra un texto genérico ("escribile a la
 * organización") hasta que se cargue uno real. */
export const PRIVACY_CONTACT_EMAIL: string | null = "anide@neuquen.gov.ar";

/** Fecha de la última actualización de la política (mostrar en la página). */
export const PRIVACY_UPDATED_AT = "13 de noviembre de 2026";

/** Bases y condiciones de la competencia (documento de la organización). */
export const TERMS_URL = "https://drive.google.com/file/d/130w9o1tIuDkZAf9w7E5QomN3kYU8_yVc/view?usp=sharing";

export interface DataProcessor {
  name: string;
  role: string;
  country: string;
}

/** Proveedores que guardan o procesan datos personales por cuenta de la
 * organización. Si la app se muda a la nube de la provincia (ver
 * docs/DEPLOY.md), actualizar la fila del alojamiento. */
export const DATA_PROCESSORS: DataProcessor[] = [
  {
    name: "Supabase",
    role: "Base de datos (inscripciones, resultados, encuesta) y cuentas de los administradores.",
    country: "Servidores en Brasil (São Paulo); empresa de Estados Unidos.",
  },
  {
    name: "Netlify",
    role: "Alojamiento del sitio web. Procesa los pedidos de cada visita (dirección IP, navegador); no guarda las inscripciones.",
    country: "Estados Unidos.",
  },
  {
    name: "Google (Drive)",
    role: "Aloja el documento de bases y condiciones. No recibe datos de la inscripción.",
    country: "Estados Unidos.",
  },
];
