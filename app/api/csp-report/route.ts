import { clientIp, takeRateLimit } from "@/lib/rate-limit";

// Recibe los reportes de la CSP en modo solo reporte (ver next.config.ts) y
// deja una línea por violación en los logs del server, para saber qué
// bloquearía la política antes de activarla. Solo se loguea qué directiva
// y qué origen: nada de la página que tenía abierta la persona ni de su
// navegador. Límite por IP para que nadie llene los logs a propósito.
export async function POST(request: Request) {
  if (!takeRateLimit(`csp:${await clientIp()}`, 30, 60_000)) return new Response(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as { "csp-report"?: Record<string, unknown> } | null;
  const report = body?.["csp-report"];
  if (report) {
    const directive = String(report["effective-directive"] ?? report["violated-directive"] ?? "?").slice(0, 80);
    let blocked = String(report["blocked-uri"] ?? "?");
    // Solo el origen (o "inline"/"eval"): la ruta completa podría traer un token.
    try {
      blocked = new URL(blocked).origin;
    } catch {
      blocked = blocked.slice(0, 40);
    }
    console.warn(`csp-report: ${directive} bloquearía ${blocked}`);
  }
  return new Response(null, { status: 204 });
}
