"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { useSectionNav, type SectionNavItem } from "./section-nav-context";
import { BrandIcon } from "@/app/components/brand-mark";
import type { EventRow } from "@/lib/database.types";
import { LockIcon } from "@/app/components/action-icons";

type SidebarEvent = Pick<EventRow, "id" | "name" | "is_public" | "status" | "event_date">;

// `superadminOnly`: catálogos globales y usuarios — un administrador de
// eventos no los ve (la RLS además rechaza la escritura, ver 0018).
const NAV_ITEMS = [
  { href: "/admin", label: "Eventos", superadminOnly: false },
  { href: "/admin/disciplinas", label: "Disciplinas", superadminOnly: true },
  { href: "/admin/categorias", label: "Categorías", superadminOnly: true },
  { href: "/admin/usuarios", label: "Usuarios", superadminOnly: true },
];

const eventStatusLabel: Record<EventRow["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  finished: "Finalizado",
};

const eventStatusDot: Record<EventRow["status"], string> = {
  draft: "bg-neutral-400",
  active: "bg-brand-green",
  finished: "bg-neutral-300",
};

/** "2026-10-17" → "17/10/2026" sin pasar por Date (evita el corrimiento de
 * zona horaria de un date-only). */
function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Estado + fecha en una línea chica: con dos eventos de nombre parecido
 * ("Encuentro Regional…") es lo que permite distinguirlos. */
function EventMeta({ ev, onPrimary = false }: { ev: SidebarEvent; onPrimary?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-[11px] leading-tight ${onPrimary ? "text-white/85" : "panel-label"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${onPrimary ? "bg-white" : eventStatusDot[ev.status]}`} aria-hidden="true" />
      {eventStatusLabel[ev.status]}
      {ev.event_date && <span aria-hidden="true">·</span>}
      {formatEventDate(ev.event_date)}
      {!ev.is_public && (
        <span className="inline-flex items-center gap-0.5 ml-auto" title="Privado: no aparece en el sitio público">
          <LockIcon className="w-3 h-3" />
          Privado
        </span>
      )}
    </span>
  );
}

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
        aria-label={`Evento actual: ${current?.name ?? "ninguno"}. Cambiar de evento`}
        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-sm text-left transition-all duration-150 active:scale-[0.98] ${
          underEventos
            ? "panel-button-primary font-medium shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 border border-transparent hover:border-brand-teal/25 hover:bg-brand-teal/8"
        }`}
      >
        <span className="flex-1 min-w-0 space-y-0.5">
          <span className="block leading-snug line-clamp-2">{current?.name ?? "Elegir evento"}</span>
          {current && <EventMeta ev={current} onPrimary={underEventos} />}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 mt-0.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
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
                className={`flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  isCurrent
                    ? "bg-brand-teal/12 text-brand-teal-dark dark:text-brand-teal font-medium"
                    : "hover:bg-brand-teal/8 text-neutral-600 dark:text-neutral-300"
                }`}
              >
                <span className="block leading-snug line-clamp-2">{ev.name}</span>
                <EventMeta ev={ev} />
              </Link>
            );
          })}
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-xs font-medium panel-label hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal transition-colors"
          >
            Ver todos los eventos
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
export function AdminSidebar({
  userEmail,
  events,
  isSuperadmin,
}: {
  userEmail: string;
  events: SidebarEvent[];
  isSuperadmin: boolean;
}) {
  const navItems = NAV_ITEMS.filter((i) => isSuperadmin || !i.superadminOnly);
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

  // En la página del evento el título de la sección ES el nombre del evento,
  // que ya muestra el selector de arriba — repetirlo (truncado) no suma.
  const currentEventName = events.find((e) => e.id === currentEventId)?.name;
  const showSectionTitle = !!section && section.title !== currentEventName;

  const nestedSections = showNested && section && (
    <div className="ml-3 pl-2.5 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-1 panel-enter">
      {!showSectionTitle ? null : section.href ? (
        <Link
          href={section.href}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium panel-label hover:bg-brand-teal/8 hover:text-brand-teal-dark dark:hover:text-brand-teal transition-colors"
        >
          {section.colorDot && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.colorDot}`} aria-hidden="true" />
          )}
          <span className="line-clamp-2">{section.title}</span>
        </Link>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium panel-label">
          {section.colorDot && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.colorDot}`} aria-hidden="true" />
          )}
          <span className="line-clamp-2">{section.title}</span>
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
            {navItems.filter((i) => i.href !== "/admin").map((item) => (
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

      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:sticky md:top-0 md:h-screen panel-nav border-r">
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
          {navItems.filter((i) => i.href !== "/admin").map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="p-3 border-t panel-nav space-y-2.5">
          <span className="block min-w-0">
            <span className="text-xs panel-label truncate block" title={userEmail}>
              {userEmail}
            </span>
            <span className="text-[11px] font-semibold text-brand-teal-dark">
              {isSuperadmin ? "Superusuario" : "Administrador de eventos"}
            </span>
          </span>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
