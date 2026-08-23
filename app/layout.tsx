import type { Metadata } from "next";
import { Geist, Geist_Mono, Rajdhani } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display técnico/esports para el "scoreboard de cancha" (título de cancha,
// nombres de equipo en el timer) — ver juez y pantalla pública por cancha.
// Restringido a esos usos puntuales, no reemplaza a geist-sans en el resto.
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liga Robótica Neuquina",
  description: "Sistema de administración y visualización de jornada — Liga Robótica Neuquina",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* `beforeInteractive` solo puede ir en el root layout (ver
            node_modules/next/dist/docs/.../script.md) — antes vivían, uno
            cada uno, dentro de app/admin/layout.tsx y public-shell.tsx
            (layouts anidados), lo que React 19 ya no deja pasar en
            silencio. Cada script busca su propio id de root (admin-theme-root
            / public-theme-root) y no hace nada si esa página no lo tiene. */}
        <Script id="admin-theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('lrn-admin-theme')==='dark'){document.getElementById('admin-theme-root').classList.add('dark');}}catch(e){}"}
        </Script>
        <Script id="public-theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('lrn-public-theme')==='dark'){document.getElementById('public-theme-root').classList.add('dark');}}catch(e){}"}
        </Script>
        {children}
      </body>
    </html>
  );
}
