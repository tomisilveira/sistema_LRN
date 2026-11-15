// URL pública del sistema (ej. https://liga.neuquen.gob.ar), para armar
// URLs absolutas: metadataBase del root layout, robots.txt y sitemap.xml.
// En Docker/nube propia hay que setear SITE_URL (se lee en build, ver
// docs/DEPLOY.md); VERCEL_URL queda de respaldo para deploys en Vercel.
export const SITE_URL = (
  process.env.SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");
