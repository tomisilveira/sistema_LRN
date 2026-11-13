"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import Robot from "./robot";
import { useReducedMotion } from "./use-reduced-motion";
import { saveEncuesta } from "./actions";
import {
  CONTACT_COPY, FACES, IDLE_REACTION, KIDS_COPY, QUIEN_OPTIONS, STEP_TITLES, TYPING_REACTION,
  audienceLabel, defFor, questionsFor, react, type Answers, type Mood, type Question,
} from "@/lib/encuesta/questions";
import { RUMBO, RUMBO_ACTUAL } from "@/lib/encuesta/rumbo";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import s from "./survey.module.css";

// Flujo completo de la encuesta (docs/encuesta-satisfaccion/diseño/
// Flow.dc.html): 0 bienvenida · 1-4 preguntas · 5 gracias. Celular en una
// columna (encabezado y navegación fijos, preguntas desplazables) y compu en
// dos columnas desde 1024 px — el cambio es solo CSS (survey.module.css):
// los robots de cada formato se renderizan los dos y uno queda oculto con
// display:none (tampoco lo leen los lectores de pantalla).
//
// "La animación premia, no frena": nada espera al robot; se puede tocar y
// avanzar mientras escribe o se mueve.

const STORAGE_KEY = "lrn-encuesta-familias-v1";
const RID_KEY = "lrn-encuesta-rid";
const IDLE_MS = 9000;

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type TextKey = "que_conto" | "como_se_entero_otro" | "momento_malo" | "cambiaria" | "chico_mas_gusto" | "chico_menos_gusto" | "email_contacto";
type Rx = { step: number; mood: Mood; msg: string } | null;

function newRespondentId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Id aleatorio de este navegador: varias familias pueden recibir el mismo
 * link (un token por equipo) y cada una cuenta como su propia respuesta. */
function respondentId(): string {
  try {
    const cur = localStorage.getItem(RID_KEY);
    if (cur) return cur;
    const id = newRespondentId();
    localStorage.setItem(RID_KEY, id);
    return id;
  } catch {
    return newRespondentId();
  }
}

export default function SurveyFlow() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [ans, setAns] = useState<Answers>({});
  const [bump, setBump] = useState(0);
  const [rx, setRx] = useState<Rx>(null);
  const [idle, setIdle] = useState(false);
  const [prog, setProg] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef(0);
  const stepRef = useRef<Step>(0);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Recuperar lo cargado si se recargó la página (sessionStorage). Tiene que
  // ser después de hidratar (el server no conoce el storage).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { step?: number; ans?: Answers };
        if (saved.ans && typeof saved.ans === "object") setAns(saved.ans);
        if (typeof saved.step === "number" && saved.step >= 0 && saved.step <= 4) setStep(saved.step as Step);
      }
    } catch {
      /* sin storage: se arranca de cero */
    }
    lastRef.current = Date.now();
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loaded || step === 5) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, ans }));
    } catch {
      /* storage lleno o bloqueado: no pasa nada */
    }
  }, [step, ans, loaded]);

  // Inactividad: 9 s sin tocar nada en los pasos 1 a 4.
  useEffect(() => {
    const t = setInterval(() => {
      const st = stepRef.current;
      if (st >= 1 && st <= 4 && Date.now() - lastRef.current > IDLE_MS) setIdle(true);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Estadísticas de "Rumbo a la 3ª edición": cuentan desde 0 en ~1 s.
  useEffect(() => {
    if (step !== 5 || reduce) return;
    let c = 0;
    const t = setInterval(() => {
      c = Math.min(1, c + 0.04);
      setProg(c);
      if (c >= 1) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [step, reduce]);

  const touch = useCallback(() => {
    lastRef.current = Date.now();
    setIdle(false);
  }, []);

  function setAnswer<K extends keyof Answers>(key: K, val: Answers[K]) {
    setAns((a) => ({ ...a, [key]: val }));
    const r = react(key, val, bump, key === "quien_responde" ? (val as string) : ans.quien_responde);
    touch();
    setBump((b) => b + 1);
    setRx({ step, mood: r[0], msg: r[1] });
  }

  function toggle(key: "como_se_entero" | "interes_propuestas", val: string) {
    const cur = ans[key] ?? [];
    setAnswer(key, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  }

  function onText(key: TextKey) {
    return (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const value = e.target.value;
      const was = ans[key];
      setAns((a) => ({ ...a, [key]: value }));
      touch();
      // Solo el primer carácter genera reacción; las teclas siguientes no.
      if (!was && value) {
        setBump((b) => b + 1);
        setRx({ step, mood: TYPING_REACTION[0], msg: TYPING_REACTION[1] });
      }
    };
  }

  function goTo(next: Step) {
    touch();
    setBump((b) => b + 1);
    setRx(null);
    setError(null);
    setStep(next);
    if (next === 5) setProg(reduce ? 1 : 0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  function nextStep() {
    if (step === 0 && !ans.quien_responde) return;
    // "Docente o referente de sede" sigue en esta misma página con sus
    // propias preguntas (questionsFor en lib/encuesta/questions.ts), armadas
    // con la devolución del equipo. Si más adelante se diseña un formulario
    // aparte, derivar acá a /encuesta-satisfaccion/docentes (conservando ?t=).
    goTo(Math.min(5, step + 1) as Step);
  }

  async function submit() {
    if (sending) return;
    setSending(true);
    setError(null);
    touch();
    const token = new URLSearchParams(window.location.search).get("t");
    const res = await saveEncuesta({
      ...ans,
      respondent_id: respondentId(),
      token,
      [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
    }).catch(() => ({ ok: false as const, error: "No pudimos guardar tus respuestas. Revisá tu conexión y probá de nuevo." }));
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nada */
    }
    goTo(5);
  }

  // Lo que dice el robot ahora.
  let rb: [Mood, string] = defFor(step, ans.quien_responde);
  if (rx && rx.step === step) rb = [rx.mood, rx.msg];
  if (idle && step >= 1 && step <= 4) rb = IDLE_REACTION;

  const inQ = step >= 1 && step <= 4;
  const pct = inQ ? ((step - 1) / 3) * 100 : 0;
  const counter = `Paso ${step} de 4`;

  return (
    <div className={s.root}>
      <aside className={`${s.panel} ${inQ ? "" : s.panelBare}`}>
        <div className={s.toprow}>
          <Image className={s.logo} src="/encuesta/logo-liga.png" alt="Liga Robótica Neuquina" width={480} height={211} priority />
          {inQ && <span className={`${s.steplbl} ${s.mobileOnly}`}>{counter}</span>}
        </div>
        <span className={`${s.eyebrow} ${s.deskOnly}`}>{audienceLabel(ans.quien_responde)} · Final Ruca Che 2026</span>
        <div className={`${s.deskRobot} ${s.deskOnly}`}>
          <Robot mood={rb[0]} message={rb[1]} size={170} layout="columna" minLines={3} bump={bump} />
        </div>
        {inQ && (
          <div className={s.trackWrap}>
            <span className={`${s.steplbl} ${s.deskOnly}`}>{counter}</span>
            <Track pct={pct} step={step} />
          </div>
        )}
        {inQ && (
          <div className={s.mobileOnly}>
            <Robot mood={rb[0]} message={rb[1]} size={58} compact minLines={3} bump={bump} />
          </div>
        )}
        <div className={`${s.ed} ${s.deskOnly}`}>
          <span className={s.edT}>Rumbo a la 3ª edición</span>
          <div className={s.edRow}>
            {RUMBO.map((e) => (
              <div key={e.anio} className={`${s.edN} ${e.anio === RUMBO_ACTUAL ? s.now : ""} ${e.proxima ? s.next : ""}`}>
                <b>{e.anio}</b>
                <span>{e.anio === RUMBO_ACTUAL ? `${e.edicion} · estás acá` : `${e.edicion} edición`}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className={s.main}>
        <div className={s.scroll} ref={scrollRef}>
          <div className={s.inner}>
            {/* key = step: el contenido se remonta y la animación de entrada
                (y el escalonado de tarjetas) se repite en cada paso. */}
            <div key={step} className={s.stepIn}>
              {step === 0 && (
                <>
                  <div className={`${s.hero} ${s.mobileOnly}`}>
                    <Robot mood={rb[0]} message={rb[1]} size={120} layout="columna" minLines={3} bump={bump} />
                  </div>
                  <span className={s.badge}>2ª edición · 2026</span>
                  <h1 className={s.h1}>¿Cómo viviste la Liga Robótica Neuquina?</h1>
                  <p className={s.lead}>
                    Gracias por ser parte de la Final en el Ruca Che. Tu opinión es la primera pieza de la <strong>3ª edición</strong>.
                  </p>
                  <div className={s.meta}>
                    <span><ClockIcon />3 minutos</span>
                    <span><LockIcon />Respuestas confidenciales</span>
                  </div>
                  <div className={s.qlist}>
                    <section className={s.card}>
                      <h2 className={s.qt} id="q_quien_responde">Para empezar, ¿quién responde?</h2>
                      <div className={s.opts} role="radiogroup" aria-labelledby="q_quien_responde">
                        {QUIEN_OPTIONS.map(([v, label]) => (
                          <label key={v} className={s.pill}>
                            <input type="radio" name="quien_responde" checked={ans.quien_responde === v} onChange={() => setAnswer("quien_responde", v)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </section>
                  </div>
                </>
              )}

              {inQ && (
                <>
                  <div className={s.stHead}>
                    <span className={s.stEye}>{counter}</span>
                    <h1 className={s.st}>{STEP_TITLES[step]}</h1>
                  </div>
                  <div className={s.qlist}>
                    {questionsFor(step as 1 | 2 | 3 | 4, ans.quien_responde).map((q, i) => (
                      <QuestionCard
                        key={"key" in q ? q.key : `${q.type}-${i}`}
                        q={q}
                        ans={ans}
                        setAnswer={setAnswer}
                        toggle={toggle}
                        onText={onText}
                      />
                    ))}
                  </div>
                </>
              )}

              {step === 5 && <Thanks rb={rb} bump={bump} prog={prog} />}
            </div>
            {/* Campo trampa anti-spam (fuera de la vista y de los lectores). */}
            <input ref={honeypotRef} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.honeypot} />
          </div>
        </div>

        {step <= 4 && (
          <nav className={s.nav} aria-label="Navegación de la encuesta">
            {error && <p className={s.error} role="alert">{error}</p>}
            <div className={s.navIn}>
              {step >= 1 && (
                <button className={`${s.btn} ${s.btnS}`} type="button" onClick={() => goTo((step - 1) as Step)}>
                  Atrás
                </button>
              )}
              {step === 4 ? (
                <button className={`${s.btn} ${s.btnO}`} type="button" onClick={submit} disabled={sending} aria-busy={sending}>
                  {sending ? "Enviando…" : "Enviar respuestas"}
                </button>
              ) : (
                <button
                  className={`${s.btn} ${s.btnP}`}
                  type="button"
                  onClick={nextStep}
                  disabled={step === 0 && !ans.quien_responde}
                >
                  {step === 0 ? "Empezar" : "Siguiente"}
                  <ArrowIcon />
                </button>
              )}
            </div>
          </nav>
        )}
      </main>

      {step === 5 && !reduce && <Confetti />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Track({ pct, step }: { pct: number; step: number }) {
  return (
    <div className={s.track} aria-hidden="true">
      <div className={s.trackLine}>
        <div className={s.trackFill} style={{ width: `${pct}%` }} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`${s.cp} ${i <= step - 1 ? s.cpOn : ""}`} style={{ left: `${(i / 3) * 100}%` }} />
        ))}
        <svg className={s.flag} width="18" height="22" viewBox="0 0 18 22">
          <path d="M3 2v19" stroke="#33525C" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 3h12l-3 4 3 4H3z" fill="#33525C" />
          <rect x="6" y="3" width="3" height="4" fill="#FFFFFF" />
          <rect x="9" y="7" width="3" height="4" fill="#FFFFFF" />
        </svg>
        <div className={s.rider} style={{ left: `${pct}%` }}>
          <svg width="30" height="30" viewBox="0 0 30 30">
            <ellipse cx="15" cy="16" rx="11" ry="13" fill="#FFA200" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M7 12 C8 10 21 9.5 23 10.5 C24.5 11.5 24.5 16 23 17.5 C20.5 20 10 20 8 17.5 C6.5 16 6.5 13.5 7 12 Z" fill="#FFFFFF" />
            <path d="M10 15.5 Q12 13 14 15.3" stroke="#33525C" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <ellipse cx="18.5" cy="14.5" rx="1.6" ry="2" fill="#33525C" />
          </svg>
        </div>
      </div>
    </div>
  );
}

type QuestionCardProps = {
  q: Question;
  ans: Answers;
  setAnswer: <K extends keyof Answers>(key: K, val: Answers[K]) => void;
  toggle: (key: "como_se_entero" | "interes_propuestas", val: string) => void;
  onText: (key: TextKey) => (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
};

function Hint({ text }: { text?: string }) {
  return text ? <p className={s.qh}>{text}</p> : null;
}

function NumRow({ label, labelledBy, from, to, cols, value, onPick }: {
  label?: string; labelledBy?: string; from: number; to: number; cols: number; value: number | undefined; onPick: (n: number) => void;
}) {
  const nums: number[] = [];
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <div className={s.nums} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="group" aria-label={label} aria-labelledby={labelledBy}>
      {nums.map((n) => (
        <button key={n} className={s.num} type="button" aria-pressed={value === n} onClick={() => onPick(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

function QuestionCard({ q, ans, setAnswer, toggle, onText }: QuestionCardProps) {
  if (q.type === "kids") {
    return (
      <section className={`${s.card} ${s.kids}`}>
        <div className={s.kidsHead}>
          <h2 className={`${s.qt} ${s.kidsTitle}`}>{KIDS_COPY.title}</h2>
          <span className={s.kidsSub}>{KIDS_COPY.sub}</span>
        </div>
        <Robot mood="saludo" message={KIDS_COPY.robot} size={64} compact />
        <label className={s.ratingL} htmlFor="f_chico_mas_gusto">{KIDS_COPY.mas}</label>
        <textarea id="f_chico_mas_gusto" className={`${s.field} ${s.fieldKid}`} placeholder={KIDS_COPY.ph} maxLength={2000}
          value={ans.chico_mas_gusto ?? ""} onChange={onText("chico_mas_gusto")} />
        <label className={s.ratingL} htmlFor="f_chico_menos_gusto">{KIDS_COPY.menos}</label>
        <textarea id="f_chico_menos_gusto" className={`${s.field} ${s.fieldKid}`} placeholder={KIDS_COPY.ph} maxLength={2000}
          value={ans.chico_menos_gusto ?? ""} onChange={onText("chico_menos_gusto")} />
      </section>
    );
  }

  if (q.type === "text") {
    const key = q.key as "que_conto" | "momento_malo" | "cambiaria";
    const id = `f_${key}`;
    return (
      <section className={s.card}>
        <label className={s.qt} htmlFor={id}>{q.title}</label>
        <Hint text={q.hint} />
        <textarea id={id} className={s.field} placeholder={q.ph} maxLength={2000} value={ans[key] ?? ""} onChange={onText(key)} />
      </section>
    );
  }

  if (q.type === "radio" || q.type === "check") {
    const multi = q.type === "check";
    const key = q.key as keyof Answers;
    const cur = ans[key];
    return (
      <section className={s.card}>
        <h2 className={s.qt} id={`q_${q.key}`}>{q.title}</h2>
        <Hint text={q.hint} />
        <div className={s.opts} role={multi ? "group" : "radiogroup"} aria-labelledby={`q_${q.key}`}>
          {q.options.map(([v, label]) => (
            <label key={v} className={s.pill}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={q.key}
                checked={multi ? Array.isArray(cur) && cur.includes(v) : cur === v}
                onChange={() => (multi ? toggle(q.key as "como_se_entero" | "interes_propuestas", v) : setAnswer(key, v as never))}
              />
              {label}
            </label>
          ))}
        </div>
        {q.key === "como_se_entero" && Array.isArray(cur) && cur.includes("otro") && (
          <>
            <label className={s.ratingL} htmlFor="f_como_se_entero_otro">¿Cuál?</label>
            <input id="f_como_se_entero_otro" className={`${s.field} ${s.input}`} type="text" maxLength={200}
              placeholder="Contanos cómo te enteraste" value={ans.como_se_entero_otro ?? ""} onChange={onText("como_se_entero_otro")} />
          </>
        )}
        {q.contact && (
          <>
            <label className={s.ratingL} htmlFor="f_email_contacto" style={{ marginTop: 6 }}>{CONTACT_COPY.label}</label>
            <input id="f_email_contacto" className={`${s.field} ${s.input}`} type="email" inputMode="email" autoComplete="email"
              placeholder={CONTACT_COPY.ph} maxLength={254} value={ans.email_contacto ?? ""} onChange={onText("email_contacto")} />
            <label className={s.consent}>
              <input type="checkbox" checked={!!ans.acepta_contacto} onChange={() => setAnswer("acepta_contacto", !ans.acepta_contacto)} />
              <span>
                {CONTACT_COPY.consent}{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                  Política de privacidad
                </a>
              </span>
            </label>
          </>
        )}
      </section>
    );
  }

  if (q.type === "faces") {
    const fid = `q_${q.key}`;
    return (
      <section className={s.card} aria-labelledby={fid}>
        <h2 className={s.qt} id={fid}>{q.title}</h2>
        <div className={s.faces} role="group" aria-labelledby={fid}>
          {FACES.map(([label, mouth], i) => {
            const on = ans[q.key] === i + 1;
            const ink = on ? "#1F3A43" : "#33525C";
            return (
              <button key={label} className={s.face} type="button" aria-pressed={on} onClick={() => setAnswer(q.key, i + 1)}>
                <svg width="46" height="46" viewBox="0 0 44 44" aria-hidden="true">
                  <circle cx="22" cy="22" r="20" fill={on ? "#FFA200" : "#E3EFF2"} />
                  {i === 4 ? (
                    <>
                      <path d="M13 19 Q16 15 19 19" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                      <path d="M25 19 Q28 15 31 19" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <circle cx="16" cy="18" r="2.2" fill={ink} />
                      <circle cx="28" cy="18" r="2.2" fill={ink} />
                    </>
                  )}
                  <path d={mouth} stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                </svg>
                {label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (q.type === "scale") {
    const key = q.key as "nps";
    const id = `q_${key}`;
    return (
      <section className={s.card} aria-labelledby={id}>
        <h2 className={s.qt} id={id}>{q.title}</h2>
        <Hint text={q.hint} />
        <NumRow labelledBy={id} from={q.from} to={q.to} cols={q.cols} value={ans[key]} onPick={(n) => setAnswer(key, n)} />
      </section>
    );
  }

  if (q.type !== "ratings") return null;
  return (
    <section className={s.card} aria-labelledby="q_ratings">
      <h2 className={s.qt} id="q_ratings">{q.title}</h2>
      <Hint text={q.hint} />
      {q.items.map(([key, label, sub]) => {
        const k = key as "puntaje_comodidad" | "puntaje_organizacion" | "puntaje_seguridad" | "puntaje_esperas";
        return (
          <div key={key} className={s.rating}>
            <span className={s.ratingL} id={`q_${key}`}>{label}</span>
            {sub && <span className={s.ratingS}>{sub}</span>}
            <NumRow labelledBy={`q_${key}`} from={1} to={5} cols={5} value={ans[k]} onPick={(n) => setAnswer(k, n)} />
          </div>
        );
      })}
    </section>
  );
}

function Thanks({ rb, bump, prog }: { rb: [Mood, string]; bump: number; prog: number }) {
  const ease = 1 - Math.pow(1 - prog, 3);
  return (
    <>
      <div className={`${s.hero} ${s.mobileOnly}`}>
        <Robot mood={rb[0]} message={rb[1]} size={130} layout="columna" minLines={2} bump={bump} />
      </div>
      <span className={s.badge}>Encuesta enviada</span>
      <h1 className={s.h1}>¡Gracias por contarnos!</h1>
      <p className={s.lead}>Con tus respuestas vamos a armar una 3ª edición todavía mejor. Nos vemos en 2027.</p>
      <div className={s.qlist}>
        <section className={`${s.card} ${s.story}`}>
          <h2 className={`${s.qt} ${s.storyTitle}`}>Rumbo a la 3ª edición</h2>
          <ol className={s.tl}>
            {RUMBO.map((e) => {
              const stats = (e.stats ?? []).filter((k) => typeof k.valor === "number");
              return (
                <li key={e.anio} className={`${s.tlI} ${e.proxima ? s.tlNext : ""}`}>
                  <span className={s.tlDot} />
                  <div className={s.tlBody}>
                    <span className={s.tlY}>{`${e.anio} · ${e.edicion} edición`}</span>
                    <span className={s.tlT}>{e.texto}</span>
                    {stats.length > 0 && (
                      <>
                        <div className={s.stats}>
                          {stats.map((k) => (
                            <div key={k.label} className={s.stat}>
                              <b>{(k.prefijo ?? "") + Math.round((k.valor as number) * ease).toLocaleString("es-AR")}</b>
                              <span>{k.label}</span>
                            </div>
                          ))}
                        </div>
                        {e.nota && <span className={s.statNote}>{e.nota}</span>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <a className={s.linkcard} href="https://www.anide.gob.ar">
        Conocé más en anide.gob.ar
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33525C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
      <p className={s.foot}>Una iniciativa de ANIDE · Red Neuquina de Robótica e Innovación</p>
    </>
  );
}

const CONFETTI_COLORS = ["#FFA200", "#B4DDE5", "#33525C", "#FFD27A", "#FFA200", "#8CC6D3"];

function Confetti() {
  const pieces: ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const w = 6 + (i % 4) * 2;
    pieces.push(
      <span
        key={i}
        className={s.cf}
        style={{
          left: `${(i * 37) % 100}%`,
          width: `${w}px`,
          height: `${i % 3 === 0 ? w : w * 1.8}px`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${((i % 12) * 0.11).toFixed(2)}s`,
          animationDuration: `${(2.2 + (i % 5) * 0.35).toFixed(2)}s`,
        }}
      />
    );
  }
  return <div className={s.confetti} aria-hidden="true">{pieces}</div>;
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#33525C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#33525C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className={s.arrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
