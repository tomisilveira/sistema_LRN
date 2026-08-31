"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface SectionNavItem {
  id: string;
  label: string;
  /** Chip corto opcional (ej. cantidad) al lado del label. */
  badge?: string | number;
}

export interface SectionNavData {
  /** Nombre de la entidad actual (evento o torneo) que agrupa los items. */
  title: string;
  /** Link opcional al detalle de la entidad (ej. volver al evento desde un torneo). */
  href?: string;
  /** Id del evento actual (evento o torneo dentro del evento) — el sidebar
   * lo usa para pintar el selector de eventos. */
  eventId?: string;
  /** Clase de color (ej. "bg-brand-teal") para el punto de disciplina, si aplica. */
  colorDot?: string;
  items: SectionNavItem[];
}

interface SectionNavContextValue {
  section: SectionNavData | null;
  activeId: string | null;
  /** Publica los items de la página actual y cuál queda activo por default.
   * Llamado desde TabbedLayout al montar/actualizar. */
  registerSection: (data: SectionNavData, defaultActiveId: string) => void;
  /** Saca los items publicados — llamado al desmontar TabbedLayout. */
  clearSection: () => void;
  setActiveId: (id: string) => void;
}

const SectionNavContext = createContext<SectionNavContextValue | null>(null);

/** Puente entre el contenido de una página (evento/torneo, con su
 * TabbedLayout) y el sidebar global del admin: así el menú de secciones de
 * la entidad activa (Formato/Equipos/Grupos/...) se pinta DENTRO del mismo
 * menú lateral, anidado bajo "Eventos", en vez de vivir como un segundo
 * menú aparte al lado del contenido. Ver app/admin/(protected)/admin-sidebar.tsx
 * y app/components/tabbed-layout.tsx. */
export function SectionNavProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<SectionNavData | null>(null);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const registerSection = useCallback((data: SectionNavData, defaultActiveId: string) => {
    setSection(data);
    setActiveIdState((prev) => (prev && data.items.some((i) => i.id === prev) ? prev : defaultActiveId));
  }, []);

  const clearSection = useCallback(() => {
    setSection(null);
    setActiveIdState(null);
  }, []);

  const setActiveId = useCallback((id: string) => setActiveIdState(id), []);

  const value = useMemo(
    () => ({ section, activeId, registerSection, clearSection, setActiveId }),
    [section, activeId, registerSection, clearSection, setActiveId]
  );

  return <SectionNavContext.Provider value={value}>{children}</SectionNavContext.Provider>;
}

export function useSectionNav() {
  const ctx = useContext(SectionNavContext);
  if (!ctx) throw new Error("useSectionNav debe usarse dentro de <SectionNavProvider>");
  return ctx;
}
