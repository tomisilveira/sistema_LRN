import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Hora del servidor, para que los relojes de cliente (juez, pantalla,
// público) corrijan el desfase del reloj del dispositivo — ver
// lib/use-server-now.ts. `timer_running_since` se escribe con la hora del
// servidor; si la tablet/TV tiene la hora corrida, restar contra su propio
// Date.now() deja el reloj trabado (atrasada) o saltando (adelantada).
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
