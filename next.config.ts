import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las respuestas. Conjunto
// conservador (no rompe nada del runtime actual: Supabase Realtime por
// WebSocket, estilos inline de Tailwind, next/font, etc.). Una CSP completa
// queda pendiente — necesita audita de todos los orígenes y probablemente
// modo report-only primero.
const securityHeaders = [
  // Fuerza HTTPS en visitas futuras (los browsers lo ignoran en localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // No dejar que el browser "adivine" el content-type de una respuesta.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // El sistema nunca se embebe en un iframe de otro sitio.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // APIs del browser que la app no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // No anunciar el framework/versión en cada respuesta.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
