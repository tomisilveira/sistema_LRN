/** Indicador de carga para los `loading.tsx` (se muestra mientras el
 * servidor arma la página). Anunciado a lectores de pantalla con
 * role="status"; la animación se apaga si el sistema pide menos movimiento. */
export function LoadingState({ label = "Cargando…", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-16 ${fullScreen ? "panel-page min-h-screen" : ""}`}
    >
      <span
        aria-hidden="true"
        className="h-9 w-9 rounded-full border-[3px] border-current/15 border-t-brand-teal animate-spin motion-reduce:animate-none"
      />
      <span className="text-sm panel-label">{label}</span>
    </div>
  );
}
