"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { useSectionNav, type SectionNavItem } from "./section-nav-context";
import { BrandIcon } from "@/app/components/brand-mark";
import type { EventRow } from "@/lib/database.types";

type SidebarEvent = Pick<EventRow, "id" | "name" | "is_public" | "status">;

const NAV_ITEMS = [
  { href: "/admin", label: "Eventos" },
  { href: "/admin/disciplinas", label: "Disciplinas" },
  { href: "/admin/categorias", label: "Categorías" },
];

const eventStatusLabel: Record<EventRow["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  finished: "Finalizado",
};

// Eventos y Torneos son rutas anidadas conceptualmente bajo "Eventos" — acá
// se decide si el link de tope queda resaltado y si corresponde mostrar las
// secciones de la entidad activa (ver SectionNavProvider).
const isUnderEventos = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/eventos") || pathname.startsWith("/admin/competencias");

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
        active
          ? "panel-button-primary font-medium shadow-sm"
          : "text-neutral-600 dark:text-neutral-400 border border-transparent hover:border-brand-teal/25 hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal dark:hover:bg-brand-teal/10"
      }`}
    >
      {label}
    </Link>
  );
}

/** Selector de eventos: reemplaza al link plano "Eventos" cuando estás
 * adentro de un evento o de un torneo. El botón muestra el evento actual;
 * al abrirlo lista todos para saltar directo, sin pasar por /admin. Se
 * expande inline (empuja el contenido) — el contenedor ya scrollea. */
function EventSwitcher({
  events,
  currentEventId,
  underEventos,
}: {
  events: SidebarEvent[];
  currentEventId: string;
  underEventos: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = events.find((e) => e.id === currentEventId);

  return (
    <div className="space-y-1">
      <span className="block text-[11px] uppercase tracking-wide panel-label px-1">Evento</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-all duration-150 active:scale-[0.98] ${
          underEventos
            ? "panel-button-primary font-medium shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 border border-transparent hover:border-brand-teal/25 hover:bg-brand-teal/8"
        }`}
      >
        {current && !current.is_public && (
          <span aria-hidden="true" title="Privado">
            🔒
          </span>
        )}
        <span className="truncate flex-1">{current?.name ?? "Elegir evento"}</span>
        <span
          className={`shrink-0 text-xs transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="rounded-lg panel-surface p-1 space-y-0.5 panel-enter">
          {events.length === 0 && <p className="text-xs panel-label px-2 py-1.5">No hay eventos.</p>}
          {events.map((ev) => {
            const isCurrent = ev.id === currentEventId;
            return (
              <Link
                key={ev.id}
                href={`/admin/eventos/${ev.id}`}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  isCurrent
                    ? "bg-brand-teal/12 text-brand-teal-dark dark:text-brand-teal font-medium"
                    : "hover:bg-brand-teal/8 text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {!ev.is_public && (
                  <span aria-hidden="true" title="Privado">
                    🔒
                  </span>
                )}
                <span className="truncate flex-1">{ev.name}</span>
                <span className="shrink-0 text-[10px] panel-label">{eventStatusLabel[ev.status]}</span>
              </Link>
            );
          })}
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-xs font-medium panel-label hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal transition-colors"
          >
            Ver todos los eventos →
          </Link>
        </div>
      )}
    </div>
  );
}

/** Botón de una sección anidada (Formato/Equipos/Grupos/...) de la
 * entidad activa. No navega — cambia cuál pestaña del TabbedLayout de la
 * página actual está visible (ver section-nav-context.tsx). */
function SectionItemButton({
  item,
  active,
  onSelect,
}: {
  item: SectionNavItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? "true" : undefined}
      className={`flex items-center justify-between gap-2 w-full rounded-md px-2.5 py-1.5 text-sm text-left whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
        active
          ? "panel-button-primary font-medium shadow-sm"
          : "text-neutral-600 dark:text-neutral-400 border border-transparent hover:border-brand-teal/25 hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal dark:hover:bg-brand-teal/10"
      }`}
    >
      <span className="truncate">{item.label}</span>
      {item.badge !== undefined && item.badge !== "" && (
        <span className={`text-xs rounded-full px-1.5 py-0.5 shrink-0 ${active ? "bg-white/25" : "panel-chip"}`}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

/** Navegación de nivel superior del admin — una barra lateral fija (como un
 * panel de administración de verdad), con "Disciplinas" y "Categorías" como
 * sus propias secciones. Cuando estás adentro de un evento o un torneo, el
 * link "Eventos" se reemplaza por un selector de eventos (saltar directo a
 * otro evento) y debajo se anidan sus secciones (Formato/Equipos/Grupos/...)
 * en este MISMO menú — el contenido de esas páginas las publica acá vía
 * SectionNavContext (ver app/components/tabbed-layout.tsx). En mobile se
 * acuesta como barra horizontal arriba. */
export function AdminSidebar({ userEmail, events }: { userEmail: string; events: SidebarEvent[] }) {
  const pathname = usePathname();
  const { section, activeId, setActiveId } = useSectionNav();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const underEventos = isUnderEventos(pathname);
  const showNested = section !== null && underEventos;
  const currentEventId = section?.eventId ?? null;

  const renderEventosItem = (nested: React.ReactNode) => {
    if (currentEventId) {
      return (
        <div className="space-y-1">
          <EventSwitcher events={events} currentEventId={currentEventId} underEventos={underEventos} />
          {nested}
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <NavLink href="/admin" label="Eventos" active={underEventos} />
        {nested}
      </div>
    );
  };

  const nestedSections = showNested && section && (
    <div className="ml-3 pl-2.5 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-1 panel-enter">
      {section.href ? (
        <Link
          href={section.href}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium panel-label hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal transition-colors"
        >
          {section.colorDot && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.colorDot}`} aria-hidden="true" />
          )}
          <span className="truncate">{section.title}</span>
        </Link>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium panel-label">
          {section.colorDot && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.colorDot}`} aria-hidden="true" />
          )}
          <span className="truncate">{section.title}</span>
        </div>
      )}
      {section.items.map((it) => (
        <SectionItemButton key={it.id} item={it} active={it.id === activeId} onSelect={setActiveId} />
      ))}
    </div>
  );

  return (
    <>
      <header className="md:hidden panel-nav panel-page border-b sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <BrandIcon className="h-7 w-7" priority />
            <span className="font-semibold text-sm">Liga Robótica Neuquina</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-2" aria-label="Secciones del admin">
          {renderEventosItem(null)}
          <div className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.filter((i) => i.href !== "/admin").map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
            ))}
          </div>
        </nav>
        {showNested && section && (
          <nav
            className="flex items-center gap-1 overflow-x-auto px-3 pb-2 -mt-1"
            aria-label={`Secciones de ${section.title}`}
          >
            <span className="text-xs panel-label shrink-0 pl-1" aria-hidden="true">
              ↳
            </span>
            {section.items.map((it) => (
              <SectionItemButton key={it.id} item={it} active={it.id === activeId} onSelect={setActiveId} />
            ))}
          </nav>
        )}
        <div className="panel-brand-stripe" />
      </header>

      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:sticky md:top-0 md:h-screen panel-nav border-r">
        <Link href="/admin" className="flex items-center gap-2.5 p-4">
          <BrandIcon className="h-8 w-8" priority />
          <span className="min-w-0">
            <span className="block font-semibold leading-tight text-sm">Liga Robótica Neuquina</span>
            <span className="block text-[11px] panel-label leading-tight">Panel de administración</span>
          </span>
        </Link>
        <div className="panel-brand-stripe" />

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Secciones del admin">
          {renderEventosItem(nestedSections)}
          {NAV_ITEMS.filter((i) => i.href !== "/admin").map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="p-3 border-t panel-nav space-y-2.5">
          <span className="text-xs panel-label truncate block" title={userEmail}>
            {userEmail}
          </span>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
