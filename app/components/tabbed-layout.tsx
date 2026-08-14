"use client";

import { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Chip corto opcional (ej. cantidad) al lado del label en el menú. */
  badge?: string | number;
  content: React.ReactNode;
}

/** Menú lateral (horizontal en mobile) que muestra una sola sección de
 * contenido a la vez. El contenido de cada pestaña ya viene renderizado por
 * el server component que llama a este layout — acá solo se decide cuál se
 * ve, así que los Server Actions dentro de cada sección siguen funcionando
 * normal. */
export function TabbedLayout({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const [active, setActive] = useState(defaultTabId ?? items[0]?.id);

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible w-full md:w-48 shrink-0 panel-card rounded-xl p-2 md:sticky md:top-6">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left whitespace-nowrap transition-colors ${
                isActive
                  ? "panel-button-primary font-medium"
                  : "panel-label hover:bg-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== "" && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 ${
                    isActive ? "bg-white/25" : "panel-chip"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 min-w-0 w-full space-y-8">
        {items.map((item) => (
          <div key={item.id} className={item.id === active ? "" : "hidden"}>
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}
