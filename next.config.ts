import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las respuestas. Conjunto
// conservador (no rompe nada del runtime actual: Supabase Realtime por
// WebSocket, estilos inline de Tailwind, next/font, etc.).

// Content Security Policy, por ahora en modo SOLO REPORTE (nov 2026): el
// navegador no bloquea nada, solo avisa (consola + POST a /api/csp-report,
// que lo deja en los logs del server). Cuando pase un evento entero sin
// reportes raros, cambiar la key a "Content-Security-Policy" para que
// bloquee de verdad.
//
// Sin nonces a propósito: un nonce obliga a renderizar cada página en cada
// pedido, y las páginas públicas dependen del ISR para aguantar al público
// (ver app/page.tsx). Por eso 'unsafe-inline' en scripts (los scripts
// inline de Next y el del tema claro/oscuro en app/layout.tsx). Patrón
// "Without Nonces" de node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
const isDev = process.env.NODE_ENV === "development";
// Supabase (REST + Realtime por WebSocket). Se lee en BUILD, igual que el
// resto de NEXT_PUBLIC_*; sirve también para un Supabase self-hosted.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseConnect = supabaseOrigin ? `${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}` : "";
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self'",
  "font-src 'self'",
  `connect-src 'self' ${supabaseConnect}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

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
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
  // El panel se entra por /login (ya no hay botón en el sitio público):
  // misma pantalla que /admin/login, con la URL corta.
  async rewrites() {
    return [{ source: "/login", destination: "/admin/login" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
