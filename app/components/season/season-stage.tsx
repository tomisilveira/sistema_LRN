"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartTooltip } from "./chart-tooltip";

const SLIDE_MS = 7000;
const fmt = (n: number) => n.toLocaleString("es-AR");

export interface StageData {
  year: number;
  sedes: { nombre: string; participantes: number; equipos: number }[];
  disciplinas: { nombre: string; equipos: number; hex: string }[];
  localidades: { nombre: string; participantes: number }[];
}

interface Slide {
  id: string;
  kicker: string;
  title: string;
}

/** Escenario de la temporada actual: un gráfico por vez que pasa solo cada
 * 7 s (barra de progreso arriba), se frena con el mouse o el foco encima y
 * se puede cambiar a mano. Con prefers-reduced-motion no avanza solo. */
export function SeasonStage({ data }: { data: StageData }) {
  const reduce = useReducedMotion();
  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = [];
    if (data.sedes.length > 1) s.push({ id: "sedes", kicker: "Encuentro a encuentro", title: "Participantes acumulados en la temporada" });
    if (data.disciplinas.length > 0) s.push({ id: "disciplinas", kicker: "Disciplinas", title: "Equipos por disciplina" });
    if (data.localidades.length > 0) s.push({ id: "localidades", kicker: "¿De dónde vienen?", title: "Localidades con más participantes" });
    return s;
  }, [data]);

  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  if (slides.length === 0) return null;
  const go = (k: number) => {
    setActive(((k % slides.length) + slides.length) % slides.length);
    setCycle((c) => c + 1);
  };
  const slide = slides[active];
  const animate = !reduce;

  return (
    <section
      className="panel-card rounded-3xl border overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carrusel"
      aria-label={`Gráficos de la temporada ${data.year}`}
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
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10 cursor-pointer"
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
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal-dark dark:text-brand-teal">{slide.kicker}</p>
          <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">{slide.title}</h3>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button" onClick={() => go(active - 1)} className="panel-button-xs rounded-full h-9 w-9 border text-sm" aria-label="Gráfico anterior">
            ←
          </button>
          <button type="button" onClick={() => go(active + 1)} className="panel-button-xs rounded-full h-9 w-9 border text-sm" aria-label="Gráfico siguiente">
            →
          </button>
        </div>
      </div>

      <div key={`${slide.id}-${cycle}`} className="px-3 sm:px-5 pb-5 pt-3">
        {slide.id === "sedes" && <SedesArea data={data} animate={animate} />}
        {slide.id === "disciplinas" && <DisciplinasPie data={data} animate={animate} />}
        {slide.id === "localidades" && <LocalidadesBars data={data} animate={animate} />}
      </div>
    </section>
  );
}

function SedesArea({ data, animate }: { data: StageData; animate: boolean }) {
  const rows = data.sedes.map((s, k) => ({
    nombre: s.nombre,
    detalle: `+${fmt(s.participantes)} en esta fecha · ${fmt(s.equipos)} equipos`,
    acumulado: data.sedes.slice(0, k + 1).reduce((n, x) => n + x.participantes, 0),
  }));
  return (
    <div className="season-chart h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 28, right: 12, bottom: 8, left: 12 }}>
          <defs>
            <linearGradient id="season-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#09aeb5" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#09aeb5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="nombre" tickLine={false} axisLine={false} interval={0} height={44} padding={{ left: 28, right: 28 }} tick={<WrappedTick />} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={<ChartTooltip unit="participantes" />} />
          <Area
            type="monotone"
            dataKey="acumulado"
            name="Acumulado"
            stroke="#09aeb5"
            strokeWidth={3}
            fill="url(#season-area)"
            dot={{ r: 5, strokeWidth: 3, className: "season-chart-dot" }}
            activeDot={{ r: 7 }}
            isAnimationActive={animate}
            animationDuration={1400}
          >
            <LabelList dataKey="acumulado" position="top" offset={12} className="season-chart-label season-chart-label-strong" />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Etiqueta del eje X partida en hasta 2 renglones (los nombres de sede no
 * entran en una línea en celular y Recharts los cortaba). */
function WrappedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value ?? "").split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 12) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const shown = lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" className="season-chart-tick" fontSize={11}>
      {shown.map((l, k) => (
        <tspan key={k} x={x} dy={k === 0 ? 4 : 13}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function DisciplinasPie({ data, animate }: { data: StageData; animate: boolean }) {
  const total = data.disciplinas.reduce((n, d) => n + d.equipos, 0);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 px-2">
      <div className="relative h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.disciplinas}
              dataKey="equipos"
              nameKey="nombre"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationDuration={1100}
            >
              {data.disciplinas.map((d) => (
                <Cell key={d.nombre} fill={d.hex} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit="equipos" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-4xl font-extrabold tabular-nums">{fmt(total)}</p>
          <p className="text-xs panel-label">equipos</p>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.disciplinas.map((d) => (
          <li key={d.nombre} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.hex }} aria-hidden="true" />
            <span className="flex-1 truncate text-sm font-semibold">{d.nombre}</span>
            <span className="font-heading text-base font-bold tabular-nums">{fmt(d.equipos)}</span>
            <span className="w-10 text-right text-xs panel-label tabular-nums">{total ? Math.round((d.equipos / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocalidadesBars({ data, animate }: { data: StageData; animate: boolean }) {
  return (
    <div className="season-chart" style={{ height: Math.max(200, data.localidades.length * 42) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.localidades} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap="22%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" tickLine={false} axisLine={false} width={124} tick={{ fontSize: 13, fontWeight: 700 }} />
          <Tooltip content={<ChartTooltip unit="participantes" />} cursor={{ className: "season-chart-cursor" }} />
          <Bar dataKey="participantes" name="Participantes" fill="#2f6fdf" radius={[0, 6, 6, 0]} isAnimationActive={animate} animationDuration={1000}>
            <LabelList dataKey="participantes" position="right" className="season-chart-label season-chart-label-strong" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
