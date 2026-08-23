"use client";

import { useEffect } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

// Boundary de error compartido por todo lo que NO es /admin (que tiene el
// suyo, ver app/admin/(protected)/error.tsx) — público, /juez, /inscripcion,
// /acreditacion, /evento/.../pantalla. Mismo criterio: sin esto, cualquier
// error de render o de Server Action tira la pantalla de crash cruda de
// Next en vez de un cartel prolijo con botón para reintentar.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Caso puntual y frecuente: el cliente quedó con el JS de un deploy
  // anterior y la Server Action que intentó llamar ya no existe en el
  // servidor nuevo (Next.js rota el id de cada Server Action en cada
  // deploy — ver node_modules/next/dist/docs/01-app/02-guides/server-actions.md
  // #deployment-considerations). `reset()` solo, sin recargar, no alcanza
  // acá porque el bundle viejo sigue siendo el mismo — hace falta una
  // recarga completa para traer el nuevo.
  // `message`/`digest` sueltos en vez de leer `error.message`/`error.digest`
  // más abajo: TypeScript trata `unstable_isUnrecognizedActionError` como un
  // type guard sobre `error`, y como `UnrecognizedActionError` no tiene
  // ningún campo que lo distinga estructuralmente de `Error`, el chequeo de
  // más abajo (`isStaleDeploy ? ... : error.message`) angosta `error` a
  // `never` en la rama "no es stale deploy" — falso positivo del narrowing,
  // no un bug real.
  const message = error.message;
  const digest = error.digest;
  const isStaleDeploy = unstable_isUnrecognizedActionError(error);

  // En producción, Next.js reemplaza el mensaje real de los errores que
  // ocurren renderizando Server Components por un texto genérico ("Minified
  // React error #...") para no filtrar detalles internos.
  const isRedacted = /Minified React error|Server Components render/i.test(message);

  return (
    <div className="panel-page min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-4 panel-enter">
        <p className="text-3xl">⚠️</p>
        <h1 className="text-lg font-semibold">Algo no salió bien</h1>
        <p className="text-sm panel-label">
          {isStaleDeploy
            ? "La página se actualizó mientras la tenías abierta — recargá para seguir."
            : isRedacted
              ? "Ocurrió un error inesperado del lado del servidor."
              : message || "Ocurrió un error inesperado."}
        </p>
        {digest && !isStaleDeploy && (
          <p className="text-xs panel-label opacity-70">
            Código: <code className="font-mono">{digest}</code>
          </p>
        )}
        <button
          onClick={() => (isStaleDeploy ? window.location.reload() : reset())}
          className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm"
        >
          {isStaleDeploy ? "Recargar página" : "Reintentar"}
        </button>
      </div>
    </div>
  );
}
