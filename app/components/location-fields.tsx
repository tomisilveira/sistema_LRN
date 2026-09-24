"use client";

import { useId, useState } from "react";
import { OTHER_PROVINCES, PRIORITY_PROVINCES, localitiesForProvince } from "@/lib/argentina-locations";

const OTHER = "__otra__";

/** Provincia + localidad del equipo. Neuquén y Río Negro primero; para esas
 * dos la localidad se elige de una lista (con "Otra localidad" por si falta
 * alguna), para el resto de las provincias se escribe. Manda al form dos
 * campos: `province` y `locality` (este último oculto, ya resuelto entre la
 * lista y lo escrito) — la validación real está en lib/team-input.ts. */
export function LocationFields({
  required = false,
  defaults,
  size = "compact",
}: {
  required?: boolean;
  defaults?: { province: string | null; locality: string | null };
  /** 'large': inputs altos de la inscripción pública; 'compact': modales
   * del admin / mesa de acreditación. */
  size?: "large" | "compact";
}) {
  const id = useId();
  const initialProvince = defaults?.province ?? "";
  const initialList = localitiesForProvince(initialProvince);
  const initialLocality = defaults?.locality ?? "";
  const initialInList = !!initialList && initialList.includes(initialLocality);

  const [province, setProvince] = useState(initialProvince);
  const [choice, setChoice] = useState(initialInList ? initialLocality : initialList && initialLocality ? OTHER : "");
  const [typed, setTyped] = useState(initialInList ? "" : initialLocality);

  const list = localitiesForProvince(province);
  const locality = list ? (choice === OTHER ? typed : choice) : typed;

  const control =
    size === "large"
      ? "w-full rounded-lg panel-input px-3 h-11 text-base"
      : "w-full rounded-md panel-input px-3 py-2 text-sm";
  const labelClass = size === "large" ? "block text-sm font-semibold panel-label" : "block text-sm panel-label mb-1";
  const star = required ? <span className="text-brand-orange"> *</span> : null;

  return (
    // En la inscripción (large) va uno debajo del otro: el formulario es
    // angosto y "Otra localidad (escribir)" no entra en media columna.
    <div className={size === "large" ? "space-y-4" : "grid gap-3 sm:grid-cols-2"}>
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={`${id}-province`}>
          Provincia{star}
          {!required && <span className="font-normal text-neutral-400"> · opcional</span>}
        </label>
        <select
          id={`${id}-province`}
          name="province"
          required={required}
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            // Cambiar de provincia invalida lo que se había elegido/escrito.
            setChoice("");
            setTyped("");
          }}
          className={control}
        >
          <option value="">Elegí la provincia</option>
          {PRIORITY_PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option disabled>──────────</option>
          {OTHER_PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={`${id}-locality`}>
          Localidad{star}
        </label>
        {!province ? (
          <select id={`${id}-locality`} disabled className={`${control} opacity-60`}>
            <option>Primero elegí la provincia</option>
          </select>
        ) : list ? (
          <select
            id={`${id}-locality`}
            required={required}
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              if (e.target.value !== OTHER) setTyped("");
            }}
            className={control}
          >
            <option value="">Elegí la localidad</option>
            {list.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value={OTHER}>Otra localidad (escribir)</option>
          </select>
        ) : (
          <input
            id={`${id}-locality`}
            required={required}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Escribí la localidad"
            className={control}
          />
        )}
        {list && choice === OTHER && (
          <input
            aria-label="Nombre de la localidad"
            required={required}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={80}
            autoFocus
            placeholder="Escribí la localidad"
            className={control}
          />
        )}
      </div>
      <input type="hidden" name="locality" value={locality.trim()} />
    </div>
  );
}
