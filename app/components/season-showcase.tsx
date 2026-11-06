"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SeasonStats } from "@/lib/season-stats";
import type { ManualSeason } from "@/lib/season-history";
import { BrandLockup } from "./brand-mark";

/** Vidriera de la portada cuando no hay ningún torneo en vivo (el resto del
 * año, hasta la próxima temporada): los números de la temporada con
 * movimiento constante — cifra principal que va rotando, cinta de números,
 * contadores que suben, y un "escenario" de gráficos que pasa solo de uno a
 * otro (se pausa con el mouse encima o tocándolo). Bajo
 * prefers-reduced-motion queda todo quieto y se cambia de gráfico a mano. */

const SLIDE_MS = 7000;
const FACT_MS = 3200;

const fmt = (n: number) => n.toLocaleString("es-AR");

interface Upcoming {
  id: string;
  name: string;
  event_date: string;
}

export function SeasonShowcase({
  season,
  previous,
  upcoming,
}: {
  season: SeasonStats;
  previous: ManualSeason | null;
  upcoming: Upcoming[];
}) {
  const facts = useMemo(() => {
    const list = [
      { value: season.participants, label: "participantes en cancha" },
      { value: season.teams, label: "equipos inscriptos" },
      { value: season.robots, label: "robots compitiendo" },
      { value: season.played, label: "partidos jugados" },
      { value: season.institutions, label: "escuelas e instituciones" },
      { value: season.localities, label: "localidades representadas" },
      { value: season.goals, label: "goles de fútbol robótico" },
      { value: season.runs, label: "vueltas cronometradas en seguidor de línea" },
    ];
    return list.filter((f) => f.value > 0);
  }, [season]);

  return (
    <div className="space-y-6">
      <Hero season={season} facts={facts} />
      <Ticker season={season} facts={facts} />
      <KpiGrid season={season} previous={previous} />
      <ChartStage season={season} previous={previous} />
      <UpcomingBlock upcoming={upcoming} nextYear={season.year + 1} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero({ season, facts }: { season: SeasonStats; facts: { value: number; label: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (facts.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % facts.length), FACT_MS);
    return () => clearInterval(t);
  }, [facts.length]);
  const fact = facts[i % Math.max(1, facts.length)];

  return (
    <section className="showcase-hero rounded-3xl px-6 py-10 sm:px-10 sm:py-14 shadow-xl">
      <div className="showcase-grid" aria-hidden="true" />
      <div className="showcase-blob showcase-blob-a h-64 w-64 -left-16 -top-20 bg-brand-teal" aria-hidden="true" />
      <div className="showcase-blob showcase-blob-b h-72 w-72 -right-20 top-10 bg-brand-pink" aria-hidden="true" />
      <div className="showcase-blob showcase-blob-c h-56 w-56 left-1/3 -bottom-24 bg-brand-orange" aria-hidden="true" />

      <div className="relative flex flex-col items-center text-center gap-5">
        <h1 className="sr-only">Liga Robótica Neuquina — temporada {season.year} en números</h1>
        <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
          <BrandLockup className="h-9 sm:h-10 w-auto" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
          Temporada {season.year} · {season.events} {season.events === 1 ? "encuentro" : "encuentros"}
        </span>

        <div className="min-h-[9.5rem] sm:min-h-[11rem] flex flex-col items-center justify-center [perspective:800px]" aria-live="polite">
          {fact && (
            <div key={i} className="showcase-flip">
              <p className="text-7xl sm:text-8xl font-black tabular-nums leading-none tracking-tight bg-gradient-to-br from-white via-white to-brand-teal bg-clip-text text-transparent drop-shadow">
                {fmt(fact.value)}
              </p>
              <p className="mt-3 text-lg sm:text-xl font-medium text-white/85">{fact.label}</p>
            </div>
          )}
        </div>

        <div className="flex gap-1.5" aria-hidden="true">
          {facts.map((f, k) => (
            <span
              key={f.label}
              className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/35"}`}
            />
          ))}
        </div>
        <p className="text-sm text-white/70 max-w-md">
          Gracias a cada escuela, familia y equipo. <strong className="text-white">Nos vemos en {season.year + 1}.</strong>
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- ticker */

function Ticker({ season, facts }: { season: SeasonStats; facts: { value: number; label: string }[] }) {
  const items = [
    ...facts.map((f) => `${fmt(f.value)} ${f.label}`),
    ...season.perEvent.map((e) => `${e.label}: ${fmt(e.teams)} equipos`),
  ];
  const dots = ["bg-brand-teal", "bg-brand-orange", "bg-brand-pink", "bg-brand-green", "bg-brand-violet"];
  const row = (hidden: boolean) =>
    items.map((t, k) => (
      <span key={`${hidden}-${k}`} className="flex items-center gap-3 px-5 whitespace-nowrap" aria-hidden={hidden || undefined}>
        <span className={`h-2 w-2 rounded-full ${dots[k % dots.length]}`} aria-hidden="true" />
        <span className="text-sm font-semibold">{t}</span>
      </span>
    ));
  return (
    <div className="showcase-marquee panel-card rounded-2xl border py-3 overflow-hidden">
      <div className="showcase-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ KPIs */

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function useCountUp(target: number, run: boolean, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    // Sin animación pedida: el primer frame ya pone el valor final.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, Math.max(0, (now - start) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

const KPI_ACCENTS = ["#09aeb5", "#f99f1b", "#ec008c", "#5eb046", "#8b5cf6", "#2f6fdf"];

function KpiGrid({ season, previous }: { season: SeasonStats; previous: ManualSeason | null }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const tiles = [
    { label: "Participantes", value: season.participants, prev: previous?.participants, note: "suma de todos los encuentros" },
    { label: "Equipos", value: season.teams, prev: previous?.teams, note: "inscripciones de la temporada" },
    { label: "Robots", value: season.robots, prev: previous?.robots, note: "en todas las disciplinas" },
    { label: "Partidos", value: season.played, prev: previous?.matches, note: "jugados de punta a punta" },
    { label: "Instituciones", value: season.institutions, prev: previous?.institutions, note: "escuelas y clubes distintos" },
    { label: "Localidades", value: season.localities, prev: previous?.localities, note: "de toda la provincia" },
  ];
  const [spot, setSpot] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setSpot((s) => (s + 1) % tiles.length);
      setTick((x) => x + 1);
    }, 2400);
    return () => clearInterval(t);
  }, [tiles.length]);

  return (
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map((t, k) => (
        <KpiTile key={t.label} {...t} run={seen} accent={KPI_ACCENTS[k]} spotlight={spot === k ? tick : null} year={season.year} />
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  prev,
  note,
  run,
  accent,
  spotlight,
  year,
}: {
  label: string;
  value: number;
  prev: number | null | undefined;
  note: string;
  run: boolean;
  accent: string;
  spotlight: number | null;
  year: number;
}) {
  const v = useCountUp(value, run);
  const growth = prev && prev > 0 ? Math.round(((value - prev) / prev) * 100) : null;
  return (
    <div className="panel-card relative overflow-hidden rounded-2xl border p-4 sm:p-5">
      {spotlight !== null && <span key={spotlight} className="showcase-spotlight pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />}
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide panel-label">{label}</p>
      <p className="mt-1 text-3xl sm:text-4xl font-black tabular-nums tracking-tight">{fmt(v)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {growth !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${growth >= 0 ? "panel-chip-success" : "panel-chip-warning"}`}
            title={`${fmt(prev!)} en ${year - 1}`}
          >
            {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% vs {year - 1}
          </span>
        )}
        <span className="text-[11px] panel-label">{note}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- chart stage */

interface Slide {
  id: string;
  kicker: string;
  title: string;
  render: () => React.ReactNode;
}

function ChartStage({ season, previous }: { season: SeasonStats; previous: ManualSeason | null }) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    if (season.perEvent.length > 0)
      list.push({
        id: "events",
        kicker: "Encuentro a encuentro",
        title: "Participantes en cada fecha",
        render: () => <EventBars season={season} />,
      });
    if (season.perEvent.length > 1)
      list.push({
        id: "cumulative",
        kicker: "La temporada crece",
        title: "Participantes acumulados",
        render: () => <CumulativeLine season={season} />,
      });
    if (season.byDiscipline.length > 0)
      list.push({
        id: "disciplines",
        kicker: "Disciplinas",
        title: "Equipos por disciplina",
        render: () => <DisciplineDonut season={season} />,
      });
    if (season.topLocalities.length > 0)
      list.push({
        id: "localities",
        kicker: "¿De dónde vienen?",
        title: "Localidades con más participantes",
        render: () => <LocalityBars season={season} />,
      });
    const compare = previous ? compareRows(season, previous) : [];
    if (previous && compare.length > 0)
      list.push({
        id: "compare",
        kicker: `${previous.year} vs ${season.year}`,
        title: "Cómo creció la liga",
        render: () => <CompareBars rows={compare} prevYear={previous.year} year={season.year} />,
      });
    return list;
  }, [season, previous]);

  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (k: number) => {
    setActive(((k % slides.length) + slides.length) % slides.length);
    setCycle((c) => c + 1);
  };
  if (slides.length === 0) return null;
  const slide = slides[active];

  return (
    <section
      className="panel-card rounded-3xl border overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carrusel"
      aria-label="Gráficos de la temporada"
    >
      <div className="flex items-center gap-1 px-4 pt-4" role="tablist" aria-label="Elegir gráfico">
        {slides.map((s, k) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={k === active}
            aria-label={s.kicker}
            onClick={() => go(k)}
            className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10 cursor-pointer"
          >
            {k < active && <span className="absolute inset-0 bg-brand-teal" />}
            {k === active && (
              <span
                key={cycle}
                className="showcase-progress absolute inset-0 bg-brand-teal"
                style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={() => go(active + 1)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3 px-5 sm:px-7 pt-5">
        <div key={`h-${cycle}`} className="showcase-pop">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-teal-dark dark:text-brand-teal">{slide.kicker}</p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{slide.title}</h2>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button" onClick={() => go(active - 1)} className="panel-button-xs rounded-full h-8 w-8 border text-sm" aria-label="Gráfico anterior">
            ←
          </button>
          <button type="button" onClick={() => go(active + 1)} className="panel-button-xs rounded-full h-8 w-8 border text-sm" aria-label="Gráfico siguiente">
            →
          </button>
        </div>
      </div>

      <div key={`${slide.id}-${cycle}`} className="px-5 sm:px-7 pb-6 pt-4 min-h-[300px]">
        {slide.render()}
      </div>
    </section>
  );
}

function EventBars({ season }: { season: SeasonStats }) {
  const max = Math.max(1, ...season.perEvent.map((e) => e.participants));
  const colors = ["#09aeb5", "#2f6fdf", "#8b5cf6", "#ec008c", "#f99f1b", "#5eb046"];
  return (
    <div className="flex h-[260px] items-end gap-3 sm:gap-5">
      {season.perEvent.map((e, k) => {
        const final = k === season.perEvent.length - 1 && /final/i.test(e.label);
        const color = colors[k % colors.length];
        // Tope 85% para que el número de la barra más alta entre arriba.
        const pct = Math.max(3, (e.participants / max) * 85);
        return (
          <div key={e.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${e.label}: ${fmt(e.participants)} participantes, ${fmt(e.teams)} equipos, ${fmt(e.played)} partidos`}>
            <div className="relative w-full max-w-[90px] flex-1">
              <div
                className="showcase-bar-y absolute inset-x-0 bottom-0 rounded-t-xl rounded-b-md"
                style={{
                  height: `${pct}%`,
                  background: `linear-gradient(to top, ${color}cc, ${color})`,
                  animationDelay: `${k * 0.12}s`,
                  boxShadow: final ? `0 10px 30px -8px ${color}` : undefined,
                }}
              />
              <p
                className="showcase-pop absolute inset-x-0 text-center text-lg sm:text-2xl font-black tabular-nums"
                style={{ bottom: `calc(${pct}% + 4px)`, animationDelay: `${0.4 + k * 0.12}s` }}
              >
                {fmt(e.participants)}
              </p>
            </div>
            <div className="text-center min-h-[2.5rem]">
              <p className="text-xs sm:text-sm font-semibold leading-tight line-clamp-2">{e.label}</p>
              <p className="text-[11px] panel-label">{fmt(e.teams)} equipos</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CumulativeLine({ season }: { season: SeasonStats }) {
  const W = 600;
  const H = 220;
  const pad = 16;
  const pts = season.perEvent.map((e, k) => ({
    label: e.label,
    add: e.participants,
    total: season.perEvent.slice(0, k + 1).reduce((n, x) => n + x.participants, 0),
  }));
  const max = Math.max(1, pts[pts.length - 1]?.total ?? 0);
  const x = (k: number) => pad + (k / Math.max(1, pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(k)},${y(p.total)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  return (
    <div>
      <div className="relative h-[230px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="showcase-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#09aeb5" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#09aeb5" stopOpacity="0" />
            </linearGradient>
            {/* Se "dibuja" de izquierda a derecha abriendo este recorte. */}
            <clipPath id="showcase-reveal">
              <rect x="0" y="-20" width={W} height={H + 40} className="showcase-reveal" />
            </clipPath>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={pad} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" />
          ))}
          <g clipPath="url(#showcase-reveal)">
            <path d={area} fill="url(#showcase-area)" />
            <path
              d={line}
              fill="none"
              stroke="#09aeb5"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
        {pts.map((p, k) => (
          <div
            key={k}
            className="showcase-pop absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(x(k) / W) * 100}%`, top: `${(y(p.total) / H) * 100}%`, animationDelay: `${0.3 + (k / pts.length) * 1.3}s` }}
            title={`${p.label}: +${fmt(p.add)} (total ${fmt(p.total)})`}
          >
            <span className="block h-3.5 w-3.5 rounded-full border-[3px] border-white dark:border-neutral-900 bg-brand-teal shadow" />
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-black tabular-nums">{fmt(p.total)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[11px] sm:text-xs panel-label">
        {pts.map((p, k) => (
          <span key={k} className={`flex-1 truncate ${k === 0 ? "text-left" : k === pts.length - 1 ? "text-right" : "text-center"}`}>
            {p.label} <span className="font-semibold text-brand-green">+{fmt(p.add)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DisciplineDonut({ season }: { season: SeasonStats }) {
  const total = Math.max(1, season.byDiscipline.reduce((n, d) => n + d.teams, 0));
  const segs = season.byDiscipline.map((d, k) => ({
    ...d,
    len: (d.teams / total) * 100,
    start: (season.byDiscipline.slice(0, k).reduce((n, x) => n + x.teams, 0) / total) * 100,
  }));
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
      <div className="relative h-52 w-52 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="16" />
          {segs.map((s, k) => (
            <circle
              key={s.name}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={s.hex}
              strokeWidth="16"
              pathLength={100}
              strokeDasharray={`${Math.max(0, s.len - 0.8)} ${100 - Math.max(0, s.len - 0.8)}`}
              strokeDashoffset={-s.start}
              className="showcase-seg"
              style={{ animationDelay: `${k * 0.15}s` }}
            >
              <title>{`${s.name}: ${s.teams} equipos`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-4xl font-black tabular-nums">{fmt(total)}</p>
          <p className="text-xs panel-label">equipos</p>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {segs.map((s, k) => (
          <li key={s.name} className="showcase-pop flex items-center gap-3" style={{ animationDelay: `${0.2 + k * 0.1}s` }}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.hex }} aria-hidden="true" />
            <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
            <span className="text-sm font-black tabular-nums">{fmt(s.teams)}</span>
            <span className="w-11 text-right text-xs panel-label tabular-nums">{Math.round((s.teams / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocalityBars({ season }: { season: SeasonStats }) {
  const max = Math.max(1, ...season.topLocalities.map((l) => l.participants));
  return (
    <ul className="space-y-3">
      {season.topLocalities.map((l, k) => (
        <li key={l.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm font-semibold">
            <span className="panel-label mr-1.5 tabular-nums">{k + 1}.</span>
            {l.label}
          </span>
          <div className="h-6 rounded-full bg-neutral-100 dark:bg-white/5 overflow-hidden">
            <div
              className="showcase-bar-x h-full rounded-full"
              style={{
                width: `${Math.max(3, (l.participants / max) * 100)}%`,
                background: "linear-gradient(90deg, #09aeb5, #2f6fdf)",
                animationDelay: `${k * 0.1}s`,
              }}
            />
          </div>
          <span className="showcase-pop w-12 text-right text-sm font-black tabular-nums" style={{ animationDelay: `${0.4 + k * 0.1}s` }}>
            {fmt(l.participants)}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface CompareRow {
  label: string;
  prev: number;
  now: number;
}

function compareRows(season: SeasonStats, prev: ManualSeason): CompareRow[] {
  const rows: [string, number | null, number][] = [
    ["Encuentros", prev.events, season.events],
    ["Equipos", prev.teams, season.teams],
    ["Participantes", prev.participants, season.participants],
    ["Robots", prev.robots, season.robots],
    ["Instituciones", prev.institutions, season.institutions],
    ["Localidades", prev.localities, season.localities],
    ["Partidos", prev.matches, season.played],
  ];
  return rows.filter((r): r is [string, number, number] => r[1] !== null && r[1] > 0).map(([label, p, now]) => ({ label, prev: p, now }));
}

function CompareBars({ rows, prevYear, year }: { rows: CompareRow[]; prevYear: number; year: number }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-neutral-400" aria-hidden="true" /> {prevYear}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-teal" aria-hidden="true" /> {year}
        </span>
      </div>
      <ul className="space-y-3">
        {rows.map((r, k) => {
          const max = Math.max(r.prev, r.now, 1);
          const growth = Math.round(((r.now - r.prev) / r.prev) * 100);
          return (
            <li key={r.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
              <span className="text-sm font-semibold">{r.label}</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="showcase-bar-x h-2.5 rounded-full bg-neutral-400" style={{ width: `${(r.prev / max) * 85}%`, animationDelay: `${k * 0.08}s` }} />
                  <span className="text-[11px] panel-label tabular-nums">{fmt(r.prev)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="showcase-bar-x h-2.5 rounded-full bg-brand-teal" style={{ width: `${(r.now / max) * 85}%`, animationDelay: `${0.15 + k * 0.08}s` }} />
                  <span className="text-[11px] font-bold tabular-nums">{fmt(r.now)}</span>
                </div>
              </div>
              <span
                className={`showcase-pop rounded-full px-2 py-0.5 text-xs font-bold ${growth >= 0 ? "panel-chip-success" : "panel-chip-warning"}`}
                style={{ animationDelay: `${0.5 + k * 0.08}s` }}
              >
                {growth >= 0 ? "+" : ""}
                {growth}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- upcoming */

function UpcomingBlock({ upcoming, nextYear }: { upcoming: Upcoming[]; nextYear: number }) {
  if (upcoming.length === 0) {
    return (
      <div className="panel-card rounded-2xl border px-5 py-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">Próxima temporada</p>
        <p className="mt-1 text-lg font-bold">Se viene la Liga Robótica Neuquina {nextYear}</p>
        <p className="text-sm panel-label">Las fechas se publican acá apenas estén confirmadas.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs panel-label uppercase tracking-wide mb-3">Próximas fechas</p>
      <div className="space-y-2 panel-enter-stagger">
        {upcoming.map((ev) => (
          <Link key={ev.id} href={`/publico/${ev.id}`} className="panel-card-button group flex items-center justify-between gap-3 rounded-xl px-4 py-3.5">
            <p className="font-medium truncate">{ev.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm panel-label">{ev.event_date}</span>
              <span className="panel-label text-lg leading-none transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
