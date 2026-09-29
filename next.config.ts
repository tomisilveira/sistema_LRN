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

// Orígenes extra desde los que se aceptan Server Actions (los botones del
// panel), separados por coma — solo si el proxy/balanceador de la nube
// reescribe el Host y los botones fallan con "Invalid Server Actions
// request". Ej: "liga.neuquen.gob.ar,*.neuquen.gob.ar". Se lee en BUILD
// (next.config se serializa dentro de la imagen). Ver docs/DEPLOY.md.
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Build autocontenido para Docker: `.next/standalone` trae server.js y
  // solo los node_modules necesarios (ver Dockerfile).
  output: "standalone",
  // No anunciar el framework/versión en cada respuesta.
  poweredByHeader: false,
  // Con varias réplicas detrás de un balanceador: mismo id en todas para
  // que un navegador con la versión vieja recargue en vez de romperse
  // durante un deploy gradual. Opcional (ver docs/DEPLOY.md).
  ...(process.env.DEPLOYMENT_ID ? { deploymentId: process.env.DEPLOYMENT_ID } : {}),
  ...(allowedOrigins.length > 0 ? { experimental: { serverActions: { allowedOrigins } } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
