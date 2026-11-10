"use client";

const fmt = (n: number) => n.toLocaleString("es-AR");

interface TooltipEntry {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  payload?: { fill?: string; detalle?: string };
}

/** Tooltip de los gráficos de Recharts con las clases del tema público
 * (claro/oscuro) en vez del recuadro blanco por defecto. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const detalle = payload[0]?.payload?.detalle;
  return (
    <div className="panel-card rounded-xl border px-3 py-2 text-sm shadow-lg">
      {label !== undefined && label !== "" && <p className="font-heading font-bold">{label}</p>}
      {detalle && <p className="text-xs panel-label mb-1">{detalle}</p>}
      <ul className="space-y-0.5">
        {payload.map((p, k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color ?? p.payload?.fill }} aria-hidden="true" />
            <span className="panel-label">{p.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums">
              {typeof p.value === "number" ? fmt(p.value) : String(p.value ?? "")}
              {unit ? ` ${unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
