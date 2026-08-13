import Script from "next/script";

// El toggle de modo claro/oscuro alterna la clase `dark` en este wrapper
// (ver theme-toggle.tsx). Arranca en oscuro (el look de siempre); el script
// `beforeInteractive` corrige antes del primer paint si el usuario había
// elegido claro — eso hace que el className del div pueda no coincidir con
// lo que renderizó el servidor, a propósito. suppressHydrationWarning le
// avisa a React que ese mismatch puntual es esperado (mismo patrón que
// recomiendan las libs de theme toggle). Se usa next/script en vez de un
// <script> plano porque React 19 ya no permite montar tags <script> propios
// durante el render de un Client/Server Component.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="admin-theme-root" className="dark panel-page min-h-full" suppressHydrationWarning>
      <Script id="admin-theme-init" strategy="beforeInteractive">
        {"try{if(localStorage.getItem('lrn-admin-theme')==='light'){document.getElementById('admin-theme-root').classList.remove('dark');}}catch(e){}"}
      </Script>
      {children}
    </div>
  );
}
