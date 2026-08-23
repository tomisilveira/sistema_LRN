// El toggle de modo claro/oscuro alterna la clase `dark` en este wrapper
// (ver theme-toggle.tsx). Arranca en claro (igual que el resto del sitio
// público desde que tiene su propio toggle); el script `beforeInteractive`
// que corrige antes del primer paint si el usuario había elegido oscuro
// vive en el root layout (app/layout.tsx) — `beforeInteractive` solo puede
// ir ahí, no en un layout anidado como este. Eso hace que el className de
// este div pueda no coincidir con lo que renderizó el servidor, a
// propósito; suppressHydrationWarning le avisa a React que ese mismatch
// puntual es esperado (mismo patrón que recomiendan las libs de theme
// toggle).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="admin-theme-root" className="panel-page min-h-full" suppressHydrationWarning>
      {children}
    </div>
  );
}
