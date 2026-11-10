"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartTooltip } from "./chart-tooltip";

export interface CompareRow {
  nombre: string;
  /** Valores por año, para cada métrica: { participantes: {2025: 110, 2026: 165}, ... } */
  participantes: Record<string, number | null>;
  robots: Record<string, number | null>;
}

type Metric = "participantes" | "robots";

const PREV_COLOR = "#94a3b8";
const NOW_COLOR = "#09aeb5";

/** Barras agrupadas: cada instancia (regionales, final) con una barra por
 * edición. Misma unidad en todo el gráfico (se elige participantes o
 * robots), así un solo eje alcanza. */
export function EditionCompareChart({ rows, years }: { rows: CompareRow[]; years: [number, number] }) {
  const reduce = useReducedMotion();
  const [metric, setMetric] = useState<Metric>("robots");
  const [prevY, nowY] = years.map(String);
  const data = rows.map((r) => ({ nombre: r.nombre, [prevY]: r[metric][prevY] ?? null, [nowY]: r[metric][nowY] ?? null }));
  const unit = metric === "robots" ? "robots" : "participantes";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: PREV_COLOR }} aria-hidden="true" /> {prevY}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: NOW_COLOR }} aria-hidden="true" /> {nowY}
          </span>
        </div>
        <div className="panel-segmented inline-flex rounded-lg p-0.5" role="group" aria-label="Qué comparar">
          {(["robots", "participantes"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`panel-segment rounded-md px-3 py-1 text-sm capitalize ${metric === m ? "panel-segment-on" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="season-chart h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 28, right: 8, bottom: 0, left: -12 }} barGap={6} barCategoryGap="28%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="nombre" tickLine={false} axisLine={false} tick={{ fontSize: 14, fontWeight: 700 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={48} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ className: "season-chart-cursor" }} />
            <Bar dataKey={prevY} name={prevY} fill={PREV_COLOR} radius={[6, 6, 0, 0]} isAnimationActive={!reduce} animationDuration={900}>
              <LabelList dataKey={prevY} position="top" className="season-chart-label" />
            </Bar>
            <Bar dataKey={nowY} name={nowY} fill={NOW_COLOR} radius={[6, 6, 0, 0]} isAnimationActive={!reduce} animationDuration={1100}>
              <LabelList dataKey={nowY} position="top" className="season-chart-label season-chart-label-strong" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
