import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition, Match } from "./database.types";

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

  // En paralelo (sep 2026): son independientes, y esto corre en CADA botón
  // del juez — antes eran dos viajes en fila (~75 ms cada uno).
  const [{ data: court }, { data: match }] = await Promise.all([
    supabase.from("courts").select("id").eq("access_token", courtToken).maybeSingle(),
    supabase.from("matches").select("*").eq("id", matchId).maybeSingle<Match>(),
  ]);
  if (!court) throw new JudgeAuthError("Link de cancha inválido.", 401);
  if (!match) throw new JudgeAuthError("Partido no encontrado.", 404);
  if (match.court_id !== court.id) {
    throw new JudgeAuthError("Este partido no está asignado a tu cancha.", 403);
  }
  return match;
}

/** Igual que assertMatchBelongsToCourt, pero trae además el torneo del
 * partido embebido en la MISMA consulta — para los endpoints que lo
 * necesitan (resultado, round, tiempo, empate). Antes era otro viaje a la
 * base después de validar. */
export async function assertMatchWithCompetition(
  supabase: SupabaseClient,
  matchId: string,
  courtToken: string | undefined | null
): Promise<{ match: Match; competition: Competition }> {
  if (!courtToken) throw new JudgeAuthError("Falta el token de cancha.", 401);

  const [{ data: court }, { data: row }] = await Promise.all([
    supabase.from("courts").select("id").eq("access_token", courtToken).maybeSingle(),
    supabase
      .from("matches")
      .select("*, competitions(*)")
      .eq("id", matchId)
      .maybeSingle<Match & { competitions: Competition | null }>(),
  ]);
  if (!court) throw new JudgeAuthError("Link de cancha inválido.", 401);
  if (!row) throw new JudgeAuthError("Partido no encontrado.", 404);
  if (row.court_id !== court.id) {
    throw new JudgeAuthError("Este partido no está asignado a tu cancha.", 403);
  }
  const { competitions: competition, ...match } = row;
  if (!competition) throw new JudgeAuthError("Competencia no encontrada.", 404);
  return { match: match as Match, competition };
}
