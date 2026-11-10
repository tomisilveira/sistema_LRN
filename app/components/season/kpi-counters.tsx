"use client";

import CountUp from "react-countup";
import { useReducedMotion } from "motion/react";

export interface KpiItem {
  label: string;
  note: string;
  value: number;
  prev: number | null;
  growth: number | null;
  accent: string;
}

const fmt = (n: number) => n.toLocaleString("es-AR");

/** Tarjetas de la edición actual con contador que sube al entrar en
 * pantalla (react-countup + scroll spy), el valor de la edición anterior y
 * el % de crecimiento. Sin animación si el sistema lo pide. */
export function KpiCounters({
  items,
  prevYear,
}: {
  items: KpiItem[];
  prevYear: number | null;
}) {
  const reduce = useReducedMotion();
  // Arriba, más grandes, lo que se puede comparar con la edición anterior;
  // abajo lo que solo se midió este año.
  const compared = items.filter((t) => t.prev !== null && prevYear !== null);
  const rest = items.filter((t) => !compared.includes(t));
  const card = (t: KpiItem, big: boolean) => (
    <div
      key={t.label}
      className={`panel-card relative overflow-hidden rounded-2xl border ${big ? "p-3 sm:p-6" : "p-4 sm:p-5"}`}
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: t.accent }}
        aria-hidden="true"
      />
      <p
        className={`font-mono font-semibold uppercase panel-label truncate ${big ? "text-[10px] tracking-normal sm:text-[11px] sm:tracking-[0.14em]" : "text-[11px] tracking-[0.14em]"}`}
      >
        {t.label}
      </p>
      <p
        className={`font-heading mt-1 font-extrabold tabular-nums tracking-tight leading-none ${big ? "text-[2rem] sm:text-6xl" : "text-4xl"}`}
      >
        {reduce ? (
          fmt(t.value)
        ) : (
          <CountUp
            end={t.value}
            duration={1.8}
            separator="."
            enableScrollSpy
            scrollSpyOnce
          >
            {/* El HTML del server ya trae el número final (igual que la rama
                sin animación, así no hay diferencia al hidratar); CountUp lo
                pone en 0 al montar y lo hace subir al entrar en pantalla. */}
            {({ countUpRef }) => <span ref={countUpRef}>{fmt(t.value)}</span>}
          </CountUp>
        )}
      </p>
      {t.prev !== null && prevYear !== null ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {t.growth !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.growth >= 0 ? "panel-chip-success" : "panel-chip-warning"}`}
            >
              {t.growth >= 0 ? "▲" : "▼"} {Math.abs(t.growth)}%
            </span>
          )}
          <span className="text-xs panel-label">
            en {prevYear}:{" "}
            <strong className="tabular-nums">{fmt(t.prev)}</strong>
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs panel-label leading-snug">{t.note}</p>
      )}
    </div>
  );
  return (
    <div className="space-y-3">
      {compared.length > 0 && (
        <div
          className={`grid ${compared.length >= 3 ? "grid-cols-3" : "grid-cols-2"} gap-2 sm:gap-3`}
        >
          {compared.map((t) => card(t, true))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {rest.map((t) => card(t, false))}
        </div>
      )}
    </div>
  );
}
