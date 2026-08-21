"use client";

import { useRef, useState, useTransition } from "react";

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
  /** Si viene, antes de llamar al action pide confirmación (window.confirm)
   * — para la opción del cuadro que sea una acción destructiva (ej. el
   * sorteo aleatorio, que pisa las asignaciones de grupo actuales). */
  confirmMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        close();
      } catch (err) {
        setError((err as Error).message ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {buttonLabel}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 panel-modal-backdrop"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-form-title"
            className="panel-page panel-card rounded-xl p-5 w-full max-w-md space-y-4 shadow-lg panel-modal-panel"
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
            </form>
          </div>
        </div>
      )}
    </>
  );
}
