// Preguntas, valores permitidos y reacciones del robot de la encuesta de
// satisfacción a familias. Fuente: docs/encuesta-satisfaccion/diseño/
// Flow.dc.html (`Q`, `DEF`, `react`) — los textos van LITERALES.
// Lo usan la página (cliente), la validación del server y la vista admin,
// así que no importa nada de servidor ni de React.

export type Mood = "saludo" | "curioso" | "feliz" | "festejo" | "pensando" | "sorpresa" | "triste" | "atento";

export const QUIEN_OPTIONS = [
  ["padres", "Mamá, papá o tutor/a"],
  ["docente", "Docente o referente de sede"],
  ["mayor", "Participante mayor de 18"],
] as const;

export type Option = readonly [string, string];

export type Question =
  | { key: "experiencia"; type: "faces"; title: string }
  | { key: string; type: "text"; title: string; hint?: string; ph: string }
  | { key: string; type: "radio" | "check"; title: string; hint?: string; options: readonly Option[]; contact?: boolean }
  | { key: string; type: "scale"; title: string; from: number; to: number; cols: number; ends: readonly [string, string] }
  | { type: "ratings"; title: string; hint: string; items: readonly (readonly [string, string, string])[] }
  | { type: "kids" };

export const FACES = [
  ["Mal", "M14 31 Q22 23 30 31"],
  ["Regular", "M14 30 Q22 26 30 30"],
  ["Bien", "M14 28 L30 28"],
  ["Muy bien", "M14 26 Q22 32 30 26"],
  ["¡Genial!", "M13 25 Q22 36 31 25"],
] as const;

export const STEP_TITLES = ["Bienvenida", "La experiencia", "Conocer la Liga", "El día del evento", "Lo que viene", "¡Gracias!"];

export const QUESTIONS: Record<1 | 2 | 3 | 4, Question[]> = {
  1: [
    { key: "experiencia", type: "faces", title: "¿Cómo vivió tu familia la experiencia Liga Robótica Neuquina?" },
    { key: "que_conto", type: "text", title: "¿Qué te contó tu hijo/a a la vuelta?", ph: "Lo que más le gustó, lo que le costó, alguna anécdota…" },
    {
      key: "primera_vez", type: "radio", title: "¿Era la primera vez que participaban?",
      options: [["primera", "Sí, fue la primera vez"], ["regional", "Ya habíamos ido a un regional"], ["2025", "Participamos también en 2025"]],
    },
    { key: "nps", type: "scale", title: "¿Qué tan probable es que recomiendes la Liga a otra familia?", from: 0, to: 10, cols: 6, ends: ["Nada probable", "Muy probable"] },
  ],
  2: [
    {
      key: "como_se_entero", type: "check", title: "¿Cómo te enteraste de la Liga?", hint: "Podés marcar más de una.",
      options: [["escuela", "Por la escuela"], ["sede", "Por la sede de robótica"], ["redes", "Por redes sociales"], ["familia", "Me contó otra familia"], ["medios", "Por la tele o la radio"]],
    },
    {
      key: "conocia_anide", type: "radio", title: "Antes de la Liga, ¿conocías a ANIDE?",
      options: [["si", "Sí, ya la conocía"], ["suena", "Me suena el nombre"], ["no", "No, no la conocía"]],
    },
    {
      key: "sede_cercana", type: "radio", title: "¿Sabías que hay una sede de robótica cerca de tu localidad?",
      options: [["si", "Sí, ya la conozco"], ["no", "No, no sabía"], ["quiero_info", "Quiero que me cuenten dónde queda"]],
    },
  ],
  3: [
    {
      key: "info_previa", type: "radio", title: "Antes del evento, ¿tenías claro el horario, el lugar y qué llevar?",
      options: [["si", "Sí, todo claro"], ["mas_o_menos", "Más o menos"], ["no", "No, me faltó información"]],
    },
    {
      type: "ratings", title: "Puntuá del 1 al 5", hint: "1 = muy mal · 5 = excelente",
      items: [
        ["puntaje_comodidad", "Comodidad para acompañar", "Lugar para ver, baños, comida, asientos"],
        ["puntaje_seguridad", "Seguridad y cuidado de los chicos", ""],
        ["puntaje_esperas", "Tiempos de espera entre competencias", ""],
      ],
    },
    {
      key: "horas_total", type: "radio", title: "¿Cuántas horas estuvieron en total?",
      options: [["<3", "Menos de 3 horas"], ["3-6", "Entre 3 y 6 horas"], [">6", "Más de 6 horas"]],
    },
    { key: "momento_malo", type: "text", title: "¿Hubo algún momento que no estuvo bueno? ¿Qué pasó?", hint: "Opcional. Nos ayuda mucho a mejorar.", ph: "Contanos con tus palabras…" },
  ],
  4: [
    {
      key: "volveria_2027", type: "radio", title: "¿Tu hijo/a quiere volver en la 3ª edición, en 2027?",
      options: [["si", "¡Sí!"], ["tal_vez", "Tal vez"], ["no", "No"]],
    },
    {
      key: "interes_propuestas", type: "check", title: "¿Te gustaría recibir información de otras propuestas de ANIDE?", hint: "Podés marcar más de una.",
      options: [["robotica", "Talleres de robótica"], ["programacion", "Programación"], ["ia", "Inteligencia artificial"]], contact: true,
    },
    { key: "cambiaria", type: "text", title: "Si pudieras cambiar o sumar una sola cosa, ¿cuál sería?", ph: "Una idea, un pedido, una mejora…" },
    { type: "kids" },
  ],
};

export const KIDS_COPY = {
  title: "Para los chicos",
  sub: "Opcional · Pasale el celu a tu hijo/a",
  robot: "¡Hola, competidor/a! Ahora te toca a vos.",
  mas: "¿Qué fue lo que más te gustó?",
  menos: "¿Y lo que menos te gustó?",
  ph: "Escribí acá…",
};

export const CONTACT_COPY = {
  label: "Mail de contacto",
  ph: "nombre@correo.com",
  consent: "Acepto que ANIDE me contacte con novedades de la Red Neuquina de Robótica e Innovación.",
};

// Mensaje inicial del robot en cada paso (0..5).
export const DEF: [Mood, string][] = [
  ["saludo", "¡Hola! Soy el robot de la Liga. ¿Me ayudás a armar la 3ª edición?"],
  ["curioso", "Arranquemos por lo más importante: ¿cómo la pasaron?"],
  ["pensando", "Ahora, unas preguntas sobre cómo conociste la Liga."],
  ["atento", "El día del evento. Sé sincero/a: nos sirve más que un aplauso."],
  ["saludo", "¡Última parada! Y al final, un ratito para los chicos."],
  ["festejo", "¡Bip bup! Tus respuestas ya están en camino."],
];

export const IDLE_REACTION: [Mood, string] = ["saludo", "¿Seguimos? Te falta poquito."];
export const TYPING_REACTION: [Mood, string] = ["curioso", "Te leo… tomate tu tiempo."];

const R: Record<string, Record<string, [Mood, string]>> = {
  quien_responde: {
    padres: ["feliz", "¡Genial! Son 3 minutos, y al final le podés pasar el celu a tu hijo/a."],
    docente: ["atento", "¡Gracias, profe! Te llevo a las preguntas para docentes."],
    mayor: ["curioso", "¡Bienvenido/a! Contame cómo viviste la competencia."],
  },
  experiencia: {
    1: ["triste", "Uy, lo lamentamos. Más adelante nos contás qué pasó."],
    2: ["pensando", "Mmm… entendido. Queremos saber qué faltó."],
    3: ["curioso", "¡Bien! ¿Qué le sumarías para que sea genial?"],
    4: ["feliz", "¡Qué bueno! Nos alegra un montón."],
    5: ["festejo", "¡Bip bup! ¡Nos encanta que la hayan pasado así!"],
  },
  conocia_anide: {
    si: ["festejo", "¡Genial! ANIDE organiza la Liga con la Red Neuquina de Robótica e Innovación."],
    suena: ["feliz", "¡Ahora ya la conocés! ANIDE organiza la Liga y tiene sedes en toda la provincia."],
    no: ["saludo", "¡Un gusto! ANIDE es la agencia de innovación de Neuquén y organiza la Liga."],
  },
  volveria_2027: {
    si: ["festejo", "¡Sííí! Te esperamos en la 3ª edición."],
    tal_vez: ["pensando", "Contanos qué cambiarías y te convencemos."],
    no: ["triste", "Uh… nos sirve mucho saber por qué."],
  },
};

const GENERIC: [Mood, string][] = [
  ["feliz", "¡Anotado!"],
  ["curioso", "¡Bip! Guardado."],
  ["feliz", "¡Buenísimo!"],
  ["atento", "¡Gracias por contarnos!"],
  ["feliz", "¡Sigamos!"],
];

/** Reacción del robot a una respuesta. `bump` es el contador de toques
 * (rota las frases genéricas). */
export function react(key: string, val: unknown, bump: number): [Mood, string] {
  const byKey = R[key];
  if (byKey && (typeof val === "string" || typeof val === "number") && byKey[String(val)]) return byKey[String(val)];
  if (key === "nps" && typeof val === "number") {
    return val >= 9
      ? ["festejo", "¡Gracias! Eso nos llena de energía."]
      : val >= 7
        ? ["feliz", "¡Bien! Vamos por el 10."]
        : ["pensando", "Anotado. Queremos que la próxima sea un 10."];
  }
  if (key === "acepta_contacto" && val === true) return ["feliz", "¡Bárbaro! Te vamos a contar las novedades de la Red."];
  return GENERIC[bump % GENERIC.length];
}

// ---------------------------------------------------------------------------
// Valores permitidos (los usa la validación del server y la vista admin).

export const CHOICE_FIELDS = {
  quien_responde: ["padres", "docente", "mayor"],
  primera_vez: ["primera", "regional", "2025"],
  conocia_anide: ["si", "suena", "no"],
  sede_cercana: ["si", "no", "quiero_info"],
  info_previa: ["si", "mas_o_menos", "no"],
  horas_total: ["<3", "3-6", ">6"],
  volveria_2027: ["si", "tal_vez", "no"],
} as const;

export const MULTI_FIELDS = {
  como_se_entero: ["escuela", "sede", "redes", "familia", "medios"],
  interes_propuestas: ["robotica", "programacion", "ia"],
} as const;

export const INT_FIELDS = {
  experiencia: [1, 5],
  nps: [0, 10],
  puntaje_comodidad: [1, 5],
  puntaje_seguridad: [1, 5],
  puntaje_esperas: [1, 5],
} as const;

export const TEXT_FIELDS = ["que_conto", "momento_malo", "cambiaria", "chico_mas_gusto", "chico_menos_gusto"] as const;

export const MAX_TEXT = 2000;

export type Answers = {
  quien_responde?: string;
  experiencia?: number;
  que_conto?: string;
  primera_vez?: string;
  nps?: number;
  como_se_entero?: string[];
  conocia_anide?: string;
  sede_cercana?: string;
  info_previa?: string;
  puntaje_comodidad?: number;
  puntaje_seguridad?: number;
  puntaje_esperas?: number;
  horas_total?: string;
  momento_malo?: string;
  volveria_2027?: string;
  interes_propuestas?: string[];
  acepta_contacto?: boolean;
  email_contacto?: string;
  cambiaria?: string;
  chico_mas_gusto?: string;
  chico_menos_gusto?: string;
};

/** Etiqueta legible de un valor (para la vista admin y el CSV). */
export function optionLabel(key: string, value: string): string {
  if (key === "quien_responde") return QUIEN_OPTIONS.find((o) => o[0] === value)?.[1] ?? value;
  for (const step of Object.values(QUESTIONS)) {
    for (const q of step) {
      if ("options" in q && q.key === key) return q.options.find((o) => o[0] === value)?.[1] ?? value;
    }
  }
  return value;
}
