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

const SITE_NAME = "Liga Robótica Neuquina";
const SITE_DESCRIPTION = "Sistema de administración y visualización de jornada — Liga Robótica Neuquina";
// `app/icon.png`, `app/apple-icon.png` y `app/opengraph-image.png` (+
// `twitter-image.png`) se detectan solos por convención de archivo — no
// hace falta declararlos acá (ver node_modules/next/dist/docs/.../app-icons.md
// y .../opengraph-image.md). metadataBase sí hace falta: sin él, Next no
// puede armar la URL absoluta de esas imágenes para los crawlers y tira un
// warning en build. VERCEL_URL lo inyecta Vercel solo en cada deploy.
const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* `beforeInteractive` solo puede ir en el root layout (ver
            node_modules/next/dist/docs/.../script.md) — antes vivía dentro
            de public-shell.tsx (layout anidado), lo que React 19 ya no deja
            pasar en silencio. Busca su propio id de root (public-theme-root)
            y no hace nada si esa página no lo tiene.
            El admin NO tiene modo oscuro (a propósito, pedido explícito del
            usuario ago 2026 — antes tenía un toggle propio que quedaba
            pegado en oscuro entre sesiones y volvía todo casi negro; ver
            app/admin/layout.tsx). El público conserva el suyo; el kiosco de
            campo (juez/inscripción/acreditación) tampoco tuvo nunca uno. */}
        <Script id="public-theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('lrn-public-theme')==='dark'){document.getElementById('public-theme-root').classList.add('dark');}}catch(e){}"}
        </Script>
        {children}
      </body>
    </html>
  );
}
