import Link from "next/link";
import { PublicThemeToggle } from "./public-theme-toggle";
import { BrandIcon } from "./brand-mark";
import { TERMS_URL } from "@/lib/privacy";

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
    <div id="public-theme-root" className="panel-page font-body min-h-screen" suppressHydrationWarning>
      <header className="panel-nav panel-page border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <BrandIcon className="h-7 w-7" priority />
            <span className="font-heading font-bold tracking-tight">Liga Robótica Neuquina</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/publico"
              className="text-xs rounded-full panel-chip px-3 py-1.5 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Todos los eventos
            </Link>
            <PublicThemeToggle />
          </nav>
        </div>
        <div className="panel-brand-stripe" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 panel-enter">{children}</main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-8">
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs panel-label"
        >
          <span>© {new Date().getFullYear()} Liga Robótica Neuquina</span>
          <Link href="/privacidad" className="underline underline-offset-2 hover:opacity-80">
            Política de privacidad
          </Link>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
            Bases y condiciones
          </a>
        </nav>
      </footer>
    </div>
  );
}
