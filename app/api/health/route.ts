import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Chequeo de salud para Docker / Kubernetes / el balanceador.
//   GET /api/health          → liveness: el proceso Node responde (siempre
//                              200 si está vivo). Usarlo para reiniciar el
//                              contenedor.
//   GET /api/health?deep=1   → readiness: además verifica que Supabase
//                              (API REST) responda. 503 si no. Usarlo para
//                              sacar la réplica del balanceador, NO para
//                              reiniciarla (si Supabase se cae, reiniciar la
//                              app no arregla nada).
// No expone datos: solo estado y latencia.
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.has("deep");
  if (!deep) return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ status: "error", supabase: "sin configurar" }, { status: 503 });
  }

  const started = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/disciplines?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      return NextResponse.json({ status: "error", supabase: `HTTP ${res.status}`, ms }, { status: 503 });
    }
    return NextResponse.json({ status: "ok", supabase: "ok", ms }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", supabase: "sin respuesta", ms: Date.now() - started }, { status: 503 });
  }
}
