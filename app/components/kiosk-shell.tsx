/** Shell compartido por las pantallas operativas de campo (juez, acreditación,
 * inscripción): claro por defecto, igual que el resto del sitio — usa la
 * MISMA paleta y componentes semánticos (panel-*) que admin y /publico, así
 * que alcanza con panel-card/panel-input/panel-label normales en los hijos.
 * Antes forzaba `.dark` siempre (pensado para mesa de jueces/acreditación);
 * se sacó a pedido explícito: todo el sistema arranca en claro sin
 * excepción. */
export function KioskShell({
  eyebrow,
  title,
  subtitle,
  maxWidthClassName = "max-w-md",
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  maxWidthClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-page min-h-screen">
      <div className={`${maxWidthClassName} mx-auto p-4`}>
        <header className="py-4 flex items-center gap-2.5 panel-enter">
          <span className="flex gap-0.5 shrink-0 panel-brand-dots" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-brand-teal" />
            <span className="w-2 h-2 rounded-full bg-brand-orange" />
            <span className="w-2 h-2 rounded-full bg-brand-pink" />
            <span className="w-2 h-2 rounded-full bg-brand-green" />
          </span>
          <div className="min-w-0">
            {eyebrow && <p className="text-sm panel-label truncate">{eyebrow}</p>}
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {subtitle && <p className="text-sm panel-label mt-0.5">{subtitle}</p>}
          </div>
        </header>
        <div className="panel-brand-stripe mb-4" />
        <div className="panel-enter">{children}</div>
      </div>
    </div>
  );
}

/** Pantalla de link inválido/vencido — misma redacción y estructura para
 * juez y acreditación (antes estaba duplicada a mano en cada page.tsx). */
export function KioskInvalidLink({ message }: { message: string }) {
  return (
    <div className="panel-page min-h-screen flex items-center justify-center p-6 text-center">
      <p className="max-w-sm">{message}</p>
    </div>
  );
}
