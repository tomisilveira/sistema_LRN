"use client";

import { useState } from "react";

export interface DisciplineTabItem {
  id: string;
  label: string;
  dotClass: string;
  isLive: boolean;
  content: React.ReactNode;
}

/** Menú horizontal con un botón por torneo del evento activo — reemplaza la
 * lista muda de links de antes. Deja clarísimo cuál se está mirando (chip
 * resaltado) y cuáles están en vivo (punto rojo pulsando). Envuelve en
 * varias líneas en mobile en vez de scrollear. */
export function HomeDisciplineMenu({
  items,
  defaultId,
}: {
  items: DisciplineTabItem[];
  defaultId: string;
}) {
  const [active, setActive] = useState(defaultId);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Torneos del evento">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              aria-current={isActive ? "true" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "panel-button-primary"
                  : "panel-chip hover:bg-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} aria-hidden="true" />
              {item.label}
              {item.isLive && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"
                  aria-label="En vivo"
                />
              )}
            </button>
          );
        })}
      </nav>
      <div>
        {items.map((item) => (
          <div key={item.id} className={item.id === active ? "" : "hidden"}>
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}
