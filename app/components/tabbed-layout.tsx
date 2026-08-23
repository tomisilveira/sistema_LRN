"use client";

import { useEffect } from "react";
import { useSectionNav } from "@/app/admin/(protected)/section-nav-context";

export interface TabItem {
  id: string;
  label: string;
  /** Chip corto opcional (ej. cantidad) al lado del label en el menú. */
  badge?: string | number;
  content: React.ReactNode;
}

/** Muestra una sola sección de contenido a la vez, pero el menú para
 * elegir cuál ya NO lo dibuja acá: lo publica en SectionNavContext para que
 * lo pinte el sidebar global del admin, anidado bajo "Eventos" — antes esto
 * era un segundo menú lateral propio al lado del contenido, y quedaban dos
 * menús verticales apilados en pantalla (ver admin-sidebar.tsx). El
 * contenido de cada pestaña ya viene renderizado por el server component
 * que llama a este layout — acá solo se decide cuál se ve, así que los
 * Server Actions dentro de cada sección siguen funcionando normal. */
export function TabbedLayout({
  items,
  defaultTabId,
  sectionTitle,
  sectionHref,
  sectionColorDot,
}: {
  items: TabItem[];
  defaultTabId?: string;
  /** Nombre de la entidad (evento o torneo) que agrupa estos items en el sidebar. */
  sectionTitle: string;
  /** Link opcional al detalle de la entidad, mostrado arriba de los items. */
  sectionHref?: string;
  /** Clase de color (ej. "bg-brand-teal") para el punto de disciplina. */
  sectionColorDot?: string;
}) {
  const { activeId, registerSection, clearSection } = useSectionNav();
  const fallbackActive = defaultTabId ?? items[0]?.id;

  // Se re-ejecuta si cambian los ids/labels/badges (ej. "Equipos (6)" pasa a
  // "Equipos (7)" tras agregar uno) para que el sidebar quede al día — no en
  // cada render, para no pisar la selección activa del usuario a cada rato.
  const itemsKey = JSON.stringify(items.map((i) => [i.id, i.label, i.badge ?? null]));
  useEffect(() => {
    registerSection(
      {
        title: sectionTitle,
        href: sectionHref,
        colorDot: sectionColorDot,
        items: items.map(({ id, label, badge }) => ({ id, label, badge })),
      },
      fallbackActive
    );
    return () => clearSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTitle, sectionHref, sectionColorDot, itemsKey, fallbackActive]);

  const active = activeId ?? fallbackActive;

  return (
    <div className="w-full min-w-0 space-y-8">
      {items.map((item) => (
        <div key={item.id} className={item.id === active ? "panel-enter" : "hidden"}>
          {item.content}
        </div>
      ))}
    </div>
  );
}
