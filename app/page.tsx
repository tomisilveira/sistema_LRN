import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-8 bg-neutral-950 text-neutral-100">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liga Robótica Neuquina</h1>
          <p className="mt-2 text-neutral-400 text-sm">
            Sistema de administración y visualización de jornada
          </p>
        </div>
        <div className="grid gap-3">
          <Link
            href="/publico"
            className="rounded-lg bg-neutral-100 text-neutral-900 font-medium py-3 px-4 hover:bg-white transition-colors"
          >
            Ver jornada en vivo
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-neutral-700 py-3 px-4 hover:bg-neutral-900 transition-colors"
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
