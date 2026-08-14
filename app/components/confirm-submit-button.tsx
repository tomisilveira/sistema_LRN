"use client";

/** Botón submit que pide confirmación antes de dejar pasar el envío del
 * formulario — para acciones destructivas (borran o pisan datos) donde un
 * click de más en medio de una jornada puede costar caro. */
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
