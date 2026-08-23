"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Eventos" },
  { href: "/admin/disciplinas", label: "Disciplinas" },
];

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

/** Navegación de nivel superior del admin — antes un header horizontal con
 * un solo link ("Eventos"); ahora una barra lateral fija de verdad (como un
 * panel de administración), con "Disciplinas" promovida a su propia sección
 * (ver app/admin/(protected)/disciplinas/page.tsx) para que el sidebar
 * tenga más de un destino real. En mobile se acuesta como barra horizontal
 * arriba, mismo patrón responsive que ya usa TabbedLayout (nav scrolleable
 * en vez de un menú hamburguesa nuevo). El contexto DENTRO de un evento/
 * torneo lo sigue dando Breadcrumbs — esto es solo navegación de tope. */
export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

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
            <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="h-0.5 w-full bg-gradient-to-r from-brand-teal via-brand-orange to-brand-pink" />
      </header>

      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:sticky md:top-0 md:h-screen panel-nav border-r">
        <Link href="/admin" className="flex items-center gap-2.5 p-4">
          <BrandDots />
          <span className="min-w-0">
            <span className="block font-semibold leading-tight text-sm">Liga Robótica Neuquina</span>
            <span className="block text-[11px] panel-label leading-tight">Panel de administración</span>
          </span>
        </Link>
        <div className="h-0.5 w-full bg-gradient-to-r from-brand-teal via-brand-orange to-brand-pink" />

        <nav className="flex-1 p-3 space-y-1" aria-label="Secciones del admin">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
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
