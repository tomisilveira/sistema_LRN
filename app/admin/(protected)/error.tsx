"use client";

import { useEffect } from "react";

// Cuando una Server Action tira un error de validación (ej. "creá los
// grupos primero"), Next.js desmonta la página y muestra el boundary de
// error más cercano — sin esto, eso significa la pantalla de crash cruda.
// Acá lo mostramos con la estética del panel y un botón para reintentar
// sin perder el contexto (vuelve a renderizar la misma página).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // En producción, Next.js reemplaza el mensaje real de los errores que
  // ocurren renderizando Server Components por un texto genérico ("Minified
  // React error #...") para no filtrar detalles internos — el mensaje real
  // solo queda en los logs del servidor (Netlify: Site → Logs → Functions),
  // buscando por este digest.
  const isRedacted = /Minified React error|Server Components render/i.test(error.message);

  return (
    <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
      <div className="max-w-sm w-full text-center space-y-4 panel-enter">
        <p className="text-3xl">⚠️</p>
        <h1 className="text-lg font-semibold">Algo no salió bien</h1>
        <p className="text-sm panel-label">
          {isRedacted
            ? "Ocurrió un error inesperado del lado del servidor."
            : error.message || "Ocurrió un error inesperado."}
        </p>
        {error.digest && (
          <p className="text-xs panel-label opacity-70">
            Código: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <button onClick={reset} className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">
          Reintentar
        </button>
      </div>
    </div>
  );
}
