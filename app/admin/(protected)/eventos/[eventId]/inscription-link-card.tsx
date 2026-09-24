"use client";

import { useSyncExternalStore } from "react";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { ExternalIcon } from "@/app/components/action-icons";

const subscribe = () => () => {};

/** El link de inscripción del evento, visible entero (no solo un botón de
 * copiar): así se puede leer en voz alta, dictar o chequear antes de
 * mandarlo. El dominio sale de la página actual (sirve igual en local, por
 * IP en la red del evento o en producción). */
export function InscriptionLinkCard({ path, openCount }: { path: string; openCount: number }) {
  // Server: sin window → se muestra solo el path; cliente: URL completa.
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const url = `${origin}${path}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 h-11 min-w-0">
        <span className="font-mono text-sm truncate select-all" title={url}>
          {url}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyLinkButton variant="toolbar" path={path} label="Copiar link" />
        <a href={path} target="_blank" rel="noopener noreferrer" className="panel-action">
          <ExternalIcon />
          Abrir como lo ven los equipos
        </a>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 text-sm font-medium ${
            openCount > 0 ? "text-brand-green" : "text-brand-orange"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${openCount > 0 ? "bg-brand-green" : "bg-brand-orange"}`}
            aria-hidden="true"
          />
          {openCount > 0
            ? `${openCount} ${openCount === 1 ? "torneo abierto" : "torneos abiertos"}`
            : "Ningún torneo abierto: el link muestra la inscripción cerrada"}
        </span>
      </div>
    </div>
  );
}
