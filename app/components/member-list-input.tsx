"use client";

import { useId, useState } from "react";
import { parseMemberNames } from "@/lib/team-display";

interface MemberRow {
  id: string;
  name: string;
  age: string;
}

let rowSeq = 0;
function newRow(name = "", age = ""): MemberRow {
  rowSeq += 1;
  return { id: `member-${rowSeq}`, name, age };
}

/** "Fulano (12)" → { name: "Fulano", age: "12" }. Cualquier otra cosa
 * (nombres cargados antes de que existiera el campo edad, o texto libre
 * viejo) entra igual, solo que sin edad — nunca se pierde un nombre ya
 * cargado por no matchear el patrón. */
function parseRow(raw: string): { name: string; age: string } {
  const match = raw.match(/^(.*)\((\d{1,2})\)\s*$/);
  if (match) return { name: match[1].trim(), age: match[2] };
  return { name: raw, age: "" };
}

/** Arma el mismo formato de texto que ya entendían todos los lugares que
 * muestran integrantes (ver parseMemberNames/TeamLabel) — un nombre por
 * línea, con la edad entre paréntesis al final si se cargó. Así el campo
 * estructurado de este componente no necesita ninguna columna nueva ni
 * tocar los ~15 lugares que ya leen `teams.member_names` como texto. */
export function serializeMembers(rows: { name: string; age: string }[]): string {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const name = r.name.trim();
      const age = r.age.trim();
      return age ? `${name} (${age})` : name;
    })
    .join("\n");
}

/** Alta de integrantes de a uno — reemplaza el textarea de texto libre por
 * una fila por persona (nombre y apellido + edad) con botón "+" para sumar
 * la siguiente y "×" para sacar una. Guarda todo en un solo input oculto
 * con el mismo formato de texto que ya esperaba `teams.member_names`
 * (ver serializeMembers), así el form que lo contenga —cliente o Server
 * Action— no necesita ningún cambio para recibirlo. */
export function MemberListInput({
  name = "member_names",
  initialValue,
  label = "Integrantes del equipo",
  helpText = "Se van a mostrar públicamente (en /publico, el modo pantalla y la cancha del juez), debajo del nombre del robot. Cargá solo lo que la organización pueda mostrar.",
  required = false,
  max,
}: {
  name?: string;
  initialValue?: string | null;
  label?: string;
  helpText?: string | null;
  /** Marca el label con * y arranca con una fila vacía si no hay valor previo. */
  required?: boolean;
  /** Tope de integrantes: deshabilita "+ Agregar" al llegar. */
  max?: number;
}) {
  const groupId = useId();
  const [rows, setRows] = useState<MemberRow[]>(() => {
    const initial = parseMemberNames(initialValue).map((raw) => {
      const { name: n, age } = parseRow(raw);
      return newRow(n, age);
    });
    if (initial.length === 0 && required) return [newRow()];
    return initial;
  });

  const atMax = max !== undefined && rows.length >= max;

  function addRow() {
    setRows((prev) => (max !== undefined && prev.length >= max ? prev : [...prev, newRow()]));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRow(id: string, field: "name" | "age", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  return (
    <div>
      <label className="block text-sm panel-label mb-1" id={groupId}>
        {label}
        {required && <span className="text-brand-orange"> *</span>}
      </label>
      <input type="hidden" name={name} value={serializeMembers(rows)} />

      <div className="space-y-2" role="group" aria-labelledby={groupId}>
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2 panel-enter">
            <input
              type="text"
              value={row.name}
              onChange={(e) => updateRow(row.id, "name", e.target.value)}
              placeholder={`Integrante ${i + 1}: nombre y apellido`}
              aria-label={`Nombre del integrante ${i + 1}`}
              className="flex-1 min-w-0 rounded-md panel-input px-3 py-2 text-sm"
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={row.age}
              onChange={(e) => updateRow(row.id, "age", e.target.value)}
              placeholder="Edad"
              aria-label={`Edad del integrante ${i + 1}`}
              className="w-[4.5rem] shrink-0 rounded-md panel-input px-2 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={`Quitar integrante ${i + 1}`}
              title="Quitar"
              className="shrink-0 w-8 h-8 rounded-md text-lg leading-none panel-label transition-colors
                hover:text-red-500 hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:bg-red-400/10"
            >
              ×
            </button>
          </div>
        ))}

        {rows.length === 0 && <p className="text-xs panel-label">Todavía no cargaste a nadie.</p>}

        <button
          type="button"
          onClick={addRow}
          disabled={atMax}
          className="text-sm font-medium rounded-md panel-button-secondary px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Agregar integrante
        </button>
        {atMax && (
          <p className="text-xs panel-label">Máximo {max} integrantes por equipo.</p>
        )}
      </div>

      {helpText && <p className="text-xs panel-label mt-1.5">{helpText}</p>}
    </div>
  );
}
