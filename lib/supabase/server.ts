import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cliente de Supabase para Server Components / Server Actions / Route
// Handlers del panel admin: usa la anon key + cookies de sesión, respeta RLS
// (is_admin() en la DB decide qué puede escribir).
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Falla clara en vez del error genérico de @supabase/ssr — típico
    // síntoma de un deploy nuevo sin las variables de entorno cargadas.
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno del server."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll fue llamado desde un Server Component sin proxy que
          // refresque la sesión — se puede ignorar si hay proxy.ts
          // renovando la sesión en cada request (ver proxy.ts).
        }
      },
    },
  });
}
