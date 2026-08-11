import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service-role key: bypassea RLS por completo.
// SOLO se importa desde código que corre en el servidor (Route Handlers),
// nunca desde un Client Component — `server-only` rompe el build si alguien
// lo intenta importar desde el cliente.
//
// Uso: el endpoint que usa el juez de cancha (app/api/matches/[matchId]/result)
// valida a mano el access_token de la cancha y recién ahí usa este cliente
// para escribir el resultado, ya que el juez no tiene sesión de Supabase Auth.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del server."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
