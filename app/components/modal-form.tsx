"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

/** Botón que abre un cuadro (modal) con un formulario adentro — al guardar,
 * llama al Server Action pasado por props y, si sale bien, cierra el cuadro
 * y limpia el form; la lista de atrás se actualiza sola porque el action ya
 * hace su revalidatePath. Si tira error, se muestra dentro del cuadro sin
 * cerrarlo. */
export function ModalFormButton({
  buttonLabel,
  buttonClassName,
  title,
  description,
  children,
  action,
  submitLabel = "Guardar",
  confirmMessage,
}: {
  buttonLabel: string;
  buttonClassName?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  action: (formData: FormData) => Promise<void>;
  submitLabel?: string;
  /** Si viene, antes de llamar al action pide confirmación (cartel propio
   * en el modal, no window.confirm) — para la opción del cuadro que sea
   * una acción destructiva (ej. el
   * sorteo aleatorio, que pisa las asignaciones de grupo actuales). */
  confirmMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    setArmed(false);
    formRef.current?.reset();
  }

  function submitNow(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        close();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
        setArmed(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Cartel de confirmación propio del sistema, no `window.confirm` — se
    // puede bloquear o no aparecer en celular/tablet (reportado en vivo
    // 2026-08-27). Primer submit con confirmMessage arma el cartel en vez
    // de guardar directo; el segundo click ya viene de handleConfirmedSubmit.
    if (confirmMessage && !armed) {
      setArmed(true);
      return;
    }
    submitNow(formData);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {buttonLabel}
      </button>
      {open &&
        createPortal(
          // Portal a document.body a propósito: cualquier ancestro con
          // `.panel-enter`/`.panel-enter-stagger` (la entrada animada de
          // casi toda página/lista del panel) deja pegado un
          // `transform: matrix(1,0,0,1,0,0)` una vez que termina la
          // animación — visualmente es la identidad, pero para CSS sigue
          // siendo "un transform distinto de none", así que arma un
          // containing block nuevo para `position: fixed`. Sin el portal,
          // este backdrop terminaba anclado a ese ancestro en vez de a la
          // ventana entera (el modal "Editar equipo" salía mal ubicado y
          // sin fondo oscuro real — reportado en vivo 2026-08-27).
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 panel-modal-backdrop"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-form-title"
              // max-h + overflow-y-auto: formularios largos (ej. "+ Agregar
              // equipo" con robots + responsable adulto + integrantes) no
              // entraban en pantallas chicas y no había forma de bajar para
              // ver el resto de los campos ni el botón "Agregar" — reportado
              // en vivo 2026-09-01.
              className="panel-page panel-card rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-lg panel-modal-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 id="modal-form-title" className="font-semibold">
                    {title}
                  </h3>
                  {description && <p className="text-xs panel-label mt-0.5">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="panel-label hover:opacity-70 hover:rotate-90 active:scale-90 transition-all duration-150 text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                {children}
                {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
                {armed ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/8 p-2.5 space-y-2 panel-enter">
                    <p className="text-sm panel-label">{confirmMessage}</p>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="flex-1 rounded-md panel-button-danger font-medium px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {pending ? "Guardando…" : "Sí, confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setArmed(false)}
                        disabled={pending}
                        className="flex-1 rounded-md panel-button-secondary px-4 py-2 text-sm disabled:opacity-50"
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {pending ? "Guardando…" : submitLabel}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md panel-button-secondary px-4 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
