import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

// Tipografías de la encuesta (SPEC §7): Exo 2 para títulos y Nunito para
// texto. Servidas desde el repo (app/fonts/, SIL OFL, subset latin variable)
// por la misma razón que las demás: el build en la nube interna no tiene
// salida a internet para next/font/google.
const exo2 = localFont({
  src: "../fonts/Exo2-Variable.woff2",
  variable: "--font-exo2",
  weight: "700 800",
  display: "swap",
});

const nunito = localFont({
  src: "../fonts/Nunito-Variable.woff2",
  variable: "--font-nunito",
  weight: "400 700",
  display: "swap",
});

const TITLE = "¿Cómo viviste la Liga Robótica Neuquina?";
const DESCRIPTION = "Encuesta a familias · 3 minutos · Respuestas confidenciales. Tu opinión es la primera pieza de la 3ª edición.";

// La imagen para compartir es opengraph-image.png / twitter-image.png de
// esta carpeta (el logo), detectada por convención de archivo.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Liga Robótica Neuquina", locale: "es_AR", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function EncuestaLayout({ children }: LayoutProps<"/encuesta-satisfaccion">) {
  return <div className={`${exo2.variable} ${nunito.variable}`}>{children}</div>;
}
