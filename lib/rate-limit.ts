import "server-only";
import { headers } from "next/headers";

// Límite de pedidos por IP en memoria, para las acciones públicas sin
// sesión (inscripción). Ventana deslizante simple: alcanza para frenar un
// script que manda cientos de envíos, sin molestar a un profe que inscribe
// varios equipos desde la red de la escuela (misma IP para todos).
//
// Vive en la memoria de cada instancia: con varias réplicas el tope real es
// N × límite, y se reinicia con cada deploy. Para algo más estricto haría
// falta un almacén compartido (Redis) — no se justifica hoy.

const hits = new Map<string, number[]>();
let lastSweep = 0;

/** IP del cliente según el proxy (x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "desconocida";
}

/** true si `key` todavía puede hacer otro pedido (y lo cuenta). */
export function takeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Limpieza ocasional para que el mapa no crezca sin fin.
  if (now - lastSweep > windowMs) {
    lastSweep = now;
    for (const [k, list] of hits) {
      if (list.every((t) => now - t > windowMs)) hits.delete(k);
    }
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
