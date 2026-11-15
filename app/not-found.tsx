import Link from "next/link";
import type { Metadata } from "next";
import { BrandIcon } from "@/app/components/brand-mark";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

// 404 de todo el sistema: rutas que no existen y los notFound() de las
// páginas (evento privado o borrado, torneo de otro administrador, link de
// juez vencido...). Mismo formato centrado que app/error.tsx, sin el header
// del sitio público, porque también la ven los administradores y los
// kioscos (juez, acreditación).
export default function NotFound() {
  return (
    <div className="panel-page min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-4 panel-enter">
        <BrandIcon className="h-14 w-14 mx-auto" />
        <p className="font-heading text-5xl font-bold tracking-tight">404</p>
        <h1 className="text-lg font-semibold">No encontramos esta página</h1>
        <p className="text-sm panel-label">
          Puede que el link esté mal escrito, que la jornada ya no sea pública o que la página se haya movido.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Link href="/" className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">
            Ir al inicio
          </Link>
          <Link href="/publico" className="rounded-md panel-button-secondary font-medium px-4 py-2 text-sm">
            Ver las jornadas
          </Link>
        </div>
      </div>
    </div>
  );
}
