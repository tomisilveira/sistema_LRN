import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "./database.types";

// Los endpoints que usa el juez de cancha (sin sesión de Supabase Auth) para
// abrir o cerrar un partido comparten esta validación: la única credencial
// es el access_token de la cancha, chequeado acá contra la DB con la
// service-role key antes de dejar tocar nada.
export class JudgeAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function assertMatchBelongsToCourt(
  supabase: SupabaseClient,
  matchId: string,
  courtToken: string | undefined | null
): Promise<Match> {
  if (!courtToken) throw new JudgeAuthError("Falta el token de cancha.", 401);

  const { data: court } = await supabase
    .from("courts")
    .select("id")
    .eq("access_token", courtToken)
    .maybeSingle();
  if (!court) throw new JudgeAuthError("Link de cancha inválido.", 401);

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle<Match>();
  if (!match) throw new JudgeAuthError("Partido no encontrado.", 404);
  if (match.court_id !== court.id) {
    throw new JudgeAuthError("Este partido no está asignado a tu cancha.", 403);
  }
  return match;
}
