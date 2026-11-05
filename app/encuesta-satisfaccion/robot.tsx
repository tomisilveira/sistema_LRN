"use client";

import { useEffect, useState } from "react";
import type { Mood } from "@/lib/encuesta/questions";
import { useReducedMotion } from "./use-reduced-motion";
import s from "./robot.module.css";

// Mascota de la encuesta (docs/encuesta-satisfaccion/diseño/Robot.dc.html).
// SVG + animaciones CSS, sin librerías. Reglas:
//   · el globo se "escribe" a 26 ms por letra y solo se reescribe cuando
//     cambia `message` (si cambia solo `mood`, no);
//   · al cambiar el mensaje el globo hace un pop de entrada (se remonta con
//     key = message, así la animación CSS se repite);
//   · cada cambio de `bump` dispara un salto de 0,46 s (mismo truco: key);
//   · `minLines` reserva el alto del globo para que la pantalla no salte;
//   · con prefers-reduced-motion el texto aparece completo y no se mueve
//     nada (además del @media del CSS).

type Props = {
  mood: Mood;
  message: string;
  size?: number;
  layout?: "fila" | "columna";
  compact?: boolean;
  minLines?: number;
  bump?: number;
};

type Eyes = "guino" | "feliz" | "abiertos" | "sorpresa" | "triste" | "pensando";

const MOODS: Record<Mood, { body: string; eyes: Eyes; eye?: string; hr?: string; hl?: string; dots?: boolean }> = {
  saludo: { body: s.float, eyes: "guino", eye: s.blink, hr: s.wave },
  curioso: { body: s.float, eyes: "abiertos", eye: s.look },
  feliz: { body: s.bounce, eyes: "feliz" },
  festejo: { body: s.jump, eyes: "feliz", hr: s.wave, hl: s.wavel },
  pensando: { body: s.tilt, eyes: "pensando", dots: true },
  sorpresa: { body: s.pop, eyes: "sorpresa" },
  triste: { body: s.droop, eyes: "triste", eye: s.blink },
  atento: { body: s.nod, eyes: "abiertos", eye: s.blink },
};

const INK = "#33525C";

function EyesSvg({ eyes }: { eyes: Eyes }) {
  switch (eyes) {
    case "guino":
      return (
        <>
          <path d="M60 89 Q70 75 80 88" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="108" cy="83" rx="8" ry="10" fill={INK} />
        </>
      );
    case "feliz":
      return (
        <>
          <path d="M60 89 Q70 75 80 88" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M98 88 Q108 74 118 87" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case "abiertos":
      return (
        <>
          <ellipse cx="70" cy="84" rx="7" ry="9" fill={INK} />
          <ellipse cx="108" cy="83" rx="7" ry="9" fill={INK} />
        </>
      );
    case "sorpresa":
      return (
        <>
          <circle cx="70" cy="84" r="11" fill={INK} />
          <circle cx="108" cy="83" r="11" fill={INK} />
          <circle cx="73" cy="80" r="3" fill="#FFFFFF" />
          <circle cx="111" cy="79" r="3" fill="#FFFFFF" />
        </>
      );
    case "triste":
      return (
        <>
          <path d="M58 74 L79 68" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M120 74 L99 68" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="70" cy="88" rx="6" ry="7" fill={INK} />
          <ellipse cx="108" cy="88" rx="6" ry="7" fill={INK} />
        </>
      );
    case "pensando":
      return (
        <>
          <ellipse cx="76" cy="78" rx="6" ry="8" fill={INK} />
          <ellipse cx="114" cy="77" rx="6" ry="8" fill={INK} />
        </>
      );
  }
}

/** Texto que se va escribiendo letra por letra. Devuelve cuántas letras de
 * `message` mostrar. El estado guarda para QUÉ mensaje se contó, así un
 * mensaje nuevo arranca en 0 en el mismo render (sin setState en el efecto). */
function useTyped(message: string, reduce: boolean): number {
  const [typed, setTyped] = useState<{ msg: string; n: number }>({ msg: "", n: 0 });

  useEffect(() => {
    if (reduce || !message) return;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setTyped({ msg: message, n });
      if (n >= message.length) clearInterval(timer);
    }, 26);
    return () => clearInterval(timer);
  }, [message, reduce]);

  if (reduce) return message.length;
  return typed.msg === message ? typed.n : 0;
}

export default function Robot({ mood, message, size = 110, layout = "fila", compact = false, minLines = 0, bump = 0 }: Props) {
  const reduce = useReducedMotion();
  const n = useTyped(message, reduce);
  const m = MOODS[mood] ?? MOODS.saludo;
  const col = layout === "columna";
  const typing = n < message.length;
  const minH = minLines ? Math.round(minLines * (compact ? 21 : 22.4) + 22) : 0;

  return (
    <div className={`${s.root} ${col ? s.col : s.row}`}>
      <svg
        width={size}
        height={Math.round(size * 1.1)}
        viewBox="0 0 200 220"
        role="img"
        aria-label="Robot de la Liga Robótica Neuquina"
        className={s.svg}
      >
        {/* key = bump: cada toque remonta el grupo y la animación de salto
            arranca de nuevo, aunque el anterior no haya terminado. */}
        <g key={bump} className={`${s.g} ${bump > 0 ? s.hop : ""}`}>
          <g className={`${s.g} ${m.body}`}>
            <g className={`${s.g} ${s.sway}`}>
              <polygon points="32,8 192,94 60,212" fill="none" stroke="#B4DDE5" strokeWidth="6" strokeLinejoin="round" />
            </g>
            <g className={`${s.hl} ${m.hl ?? ""}`}>
              <path d="M30 108 C20 120 8 135 12 148 C16 157 29 155 33 144 C37 132 35 118 30 108 Z" fill={INK} />
            </g>
            <path
              d="M90 27 C126 27 146 55 146 95 C146 140 122 183 90 183 C62 183 36 150 34 100 C33 58 54 27 90 27 Z"
              fill="#FFA200"
              stroke="#FFFFFF"
              strokeWidth="6"
            />
            <path d="M50 66 C53 59 112 56 124 60 C135 64 139 86 132 100 C120 116 66 120 50 104 C42 96 44 76 50 66 Z" fill="#FFFFFF" />
            <g className={`${s.g} ${m.eye ?? ""}`}>
              <EyesSvg eyes={m.eyes} />
            </g>
            <g className={`${s.hr} ${m.hr ?? ""}`}>
              <path
                d="M150 112 C160 128 176 132 186 122 C194 112 190 96 176 94 C168 93 164 100 168 106 C171 112 166 118 158 116 C154 115 152 113 150 112 Z"
                fill={INK}
              />
            </g>
            {m.dots && (
              <g className={s.dots}>
                <circle cx="160" cy="40" r="5" fill={INK} />
                <circle cx="176" cy="30" r="6" fill={INK} />
                <circle cx="194" cy="18" r="7" fill={INK} />
              </g>
            )}
          </g>
        </g>
      </svg>
      {message.length > 0 && (
        <div
          key={message}
          className={`${s.bubble} ${s.bpop} ${col ? s.bubbleCol : ""} ${compact ? s.compact : ""}`}
          style={{ minHeight: minH ? `${minH}px` : undefined }}
        >
          {/* El texto completo, invisible, fija el tamaño final del globo. */}
          <span className={s.ghost} aria-hidden="true">{message}</span>
          <span className={s.typed} aria-hidden="true">
            {message.slice(0, n)}
            {typing && <span className={s.caret}>▍</span>}
          </span>
          {/* Para lectores de pantalla: el mensaje entero de una vez, no
              letra por letra. */}
          <span className={s.srOnly} aria-live="polite">{message}</span>
        </div>
      )}
    </div>
  );
}
