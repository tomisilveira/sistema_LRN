import Link from "next/link";
import { PublicThemeToggle } from "./public-theme-toggle";

/** Shell compartido entre el inicio (app/page.tsx) y toda la sección
 * /publico — mismo header (logo, "Todos los eventos", toggle de tema,
 * "Ingresar como administrador") y mismo root de tema claro/oscuro
 * (id="public-theme-root"), para que se vean como una sola cosa en vez de
 * cada página con su propio estilo. Arranca en claro; si el usuario ya
 * había elegido oscuro, el script `beforeInteractive` del root layout
 * (app/layout.tsx) lo aplica antes del primer paint — no puede vivir acá,
 * `beforeInteractive` solo se permite en el root layout (mismo patrón
 * invertido que admin, ver app/admin/layout.tsx). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="public-theme-root" className="panel-page min-h-screen" suppressHydrationWarning>
      <header className="panel-nav panel-page border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex gap-1 panel-brand-dots" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              <span className="w-2 h-2 rounded-full bg-brand-pink" />
              <span className="w-2 h-2 rounded-full bg-brand-green" />
            </span>
            <span className="font-semibold">Liga Robótica Neuquina</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/publico"
              className="text-xs rounded-full panel-chip px-3 py-1.5 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Todos los eventos
            </Link>
            <PublicThemeToggle />
            <Link
              href="/admin/login"
              className="text-xs rounded-full panel-button-primary px-3 py-1.5 whitespace-nowrap transition"
            >
              Ingresar como administrador
            </Link>
          </nav>
        </div>
        <div className="h-0.5 w-full bg-gradient-to-r from-brand-teal via-brand-orange to-brand-pink" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 panel-enter">{children}</main>
    </div>
  );
}
