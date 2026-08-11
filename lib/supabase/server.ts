import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cliente de Supabase para Server Components / Server Actions / Route
// Handlers del panel admin: usa la anon key + cookies de sesión, respeta RLS
// (is_admin() en la DB decide qué puede escribir).
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // setAll fue llamado desde un Server Component sin middleware que
            // refresque la sesión — se puede ignorar si hay middleware.ts
            // renovando la sesión en cada request (ver middleware.ts).
          }
        },
      },
    }
  );
}
