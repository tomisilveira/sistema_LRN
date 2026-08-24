"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";
import { useSectionNav, type SectionNavItem } from "./section-nav-context";

const NAV_ITEMS = [
  { href: "/admin", label: "Eventos" },
  { href: "/admin/disciplinas", label: "Disciplinas" },
];

// Eventos y Torneos son rutas anidadas conceptualmente bajo "Eventos" — acá
// se decide si el link de tope queda resaltado y si corresponde mostrar las
// secciones de la entidad activa (ver SectionNavProvider).
const isUnderEventos = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/eventos") || pathname.startsWith("/admin/competencias");

function BrandDots() {
  return (
    <span className="flex gap-0.5 shrink-0 panel-brand-dots" aria-hidden="true">
      <span className="w-2 h-2 rounded-full bg-brand-teal" />
      <span className="w-2 h-2 rounded-full bg-brand-orange" />
      <span className="w-2 h-2 rounded-full bg-brand-pink" />
      <span className="w-2 h-2 rounded-full bg-brand-green" />
    </span>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
        active
          ? "panel-button-primary font-medium shadow-sm"
          : "panel-label hover:bg-neutral-200 dark:hover:bg-neutral-800"
      }`}
    >
      {label}
    </Link>
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
          : "panel-label hover:bg-neutral-200 dark:hover:bg-neutral-800"
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
 * panel de administración de verdad), con "Disciplinas" como su propia
 * sección. Cuando estás adentro de un evento o un torneo, sus secciones
 * (Formato/Equipos/Grupos/...) se anidan bajo "Eventos" en este MISMO menú
 * en vez de dibujarse como un segundo menú aparte al lado del contenido —
 * el contenido de esas páginas las publica acá vía SectionNavContext (ver
 * app/components/tabbed-layout.tsx). En mobile se acuesta como barra
 * horizontal arriba, con una segunda fila para las secciones anidadas
 * cuando corresponde. */
export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { section, activeId, setActiveId } = useSectionNav();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const showNested = section !== null && isUnderEventos(pathname);

  return (
    <>
      <header className="md:hidden panel-nav border-b sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <BrandDots />
            <span className="font-semibold text-sm">Liga Robótica Neuquina</span>
          </Link>
          <ThemeToggle />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Secciones del admin">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.href === "/admin" ? isUnderEventos(pathname) : isActive(item.href)}
            />
          ))}
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
          <BrandDots />
          <span className="min-w-0">
            <span className="block font-semibold leading-tight text-sm">Liga Robótica Neuquina</span>
            <span className="block text-[11px] panel-label leading-tight">Panel de administración</span>
          </span>
        </Link>
        <div className="panel-brand-stripe" />

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Secciones del admin">
          {NAV_ITEMS.map((item) => {
            if (item.href !== "/admin") {
              return <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />;
            }
            return (
              <div key={item.href} className="space-y-1">
                <NavLink href={item.href} label={item.label} active={isUnderEventos(pathname)} />
                {showNested && section && (
                  <div className="ml-3 pl-2.5 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-1 panel-enter">
                    {section.href ? (
                      <Link
                        href={section.href}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium panel-label hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
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
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t panel-nav space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs panel-label truncate" title={userEmail}>
              {userEmail}
            </span>
            <ThemeToggle />
          </div>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
