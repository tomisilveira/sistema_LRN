import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-8 bg-neutral-950 text-neutral-100">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-teal" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-orange" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-pink" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Liga Robótica Neuquina</h1>
          <p className="text-neutral-400 text-sm">
            Sistema de administración y visualización de jornada
          </p>
        </div>
        <div className="grid gap-3">
          <Link
            href="/publico"
            className="rounded-lg bg-brand-teal text-white font-medium py-3 px-4 transition hover:brightness-90"
          >
            Ver jornada en vivo
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-brand-teal/40 text-brand-teal py-3 px-4 hover:bg-brand-teal/10 transition-colors"
          >
            Panel de administración
          </Link>
        </div>
        <p className="text-xs text-neutral-500">
          ¿Sos juez de cancha? Usá el link que te compartió la organización.
        </p>
      </div>
    </main>
  );
}
