import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente anónimo SIN cookies para las páginas públicas (inicio, /publico,
// pantalla, próximos). No leer cookies es lo que permite que Next guarde la
// página ya armada y la rearme una sola vez cada pocos segundos para todos
// (ISR, `export const revalidate = N` en cada página) en vez de una vez por
// celular: con ~80 consultas por render, 300 personas mirando tiraban la
// base (prueba de carga oct 2026). Ve exactamente lo mismo que un visitante
// sin login (rol anon + RLS).
export function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno del server."
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
