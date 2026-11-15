import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition, Match } from "./database.types";
import { clientIp, isRateLimited, takeRateLimit } from "./rate-limit";

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

// Límites por IP (nov 2026). Los tokens de cancha son UUID al azar, así que
// adivinar uno no es realista; esto frena a un script que inunde la base
// con pedidos o pruebe tokens en masa.
// - Pedidos totales: generoso, porque en el evento varias tablets de juez
//   comparten el wifi (misma IP) y un juez puede tocar varias veces por
//   segundo. 600/min ≈ 10 canchas tocando un botón por segundo.
// - Tokens inválidos: 20 cada 10 min por IP; después se corta hasta que
//   pase la ventana. Un link mal copiado no llega nunca a 20.
const JUDGE_REQUESTS_PER_MIN = 600;
const JUDGE_BAD_TOKENS = 20;
const JUDGE_BAD_TOKEN_WINDOW_MS = 10 * 60 * 1000;

/** Corre al principio de cada endpoint del juez: corta con 429 si la IP
 * mandó demasiados pedidos o demasiados tokens inválidos. Devuelve la IP
 * para registrar un token inválido con recordBadJudgeToken. */
export async function judgeRateLimit(): Promise<string> {
  const ip = await clientIp();
  if (isRateLimited(`juez-token:${ip}`, JUDGE_BAD_TOKENS, JUDGE_BAD_TOKEN_WINDOW_MS)) {
    throw new JudgeAuthError("Demasiados intentos con un link de cancha inválido. Esperá unos minutos.", 429);
  }
  if (!takeRateLimit(`juez:${ip}`, JUDGE_REQUESTS_PER_MIN, 60_000)) {
    throw new JudgeAuthError("Demasiados pedidos seguidos. Esperá un momento y probá de nuevo.", 429);
  }
  return ip;
}

export function recordBadJudgeToken(ip: string): void {
  takeRateLimit(`juez-token:${ip}`, Number.MAX_SAFE_INTEGER, JUDGE_BAD_TOKEN_WINDOW_MS);
}

export async function assertMatchBelongsToCourt(
  supabase: SupabaseClient,
  matchId: string,
  courtToken: string | undefined | null
): Promise<Match> {
  const ip = await judgeRateLimit();
  if (!courtToken) throw new JudgeAuthError("Falta el token de cancha.", 401);

  // En paralelo (sep 2026): son independientes, y esto corre en CADA botón
  // del juez — antes eran dos viajes en fila (~75 ms cada uno).
  const [{ data: court }, { data: match }] = await Promise.all([
    supabase.from("courts").select("id").eq("access_token", courtToken).maybeSingle(),
    supabase.from("matches").select("*").eq("id", matchId).maybeSingle<Match>(),
  ]);
  if (!court) {
    recordBadJudgeToken(ip);
    throw new JudgeAuthError("Link de cancha inválido.", 401);
  }
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
  const ip = await judgeRateLimit();
  if (!courtToken) throw new JudgeAuthError("Falta el token de cancha.", 401);

  const [{ data: court }, { data: row }] = await Promise.all([
    supabase.from("courts").select("id").eq("access_token", courtToken).maybeSingle(),
    supabase
      .from("matches")
      .select("*, competitions(*)")
      .eq("id", matchId)
      .maybeSingle<Match & { competitions: Competition | null }>(),
  ]);
  if (!court) {
    recordBadJudgeToken(ip);
    throw new JudgeAuthError("Link de cancha inválido.", 401);
  }
  if (!row) throw new JudgeAuthError("Partido no encontrado.", 404);
  if (row.court_id !== court.id) {
    throw new JudgeAuthError("Este partido no está asignado a tu cancha.", 403);
  }
  const { competitions: competition, ...match } = row;
  if (!competition) throw new JudgeAuthError("Competencia no encontrada.", 404);
  return { match: match as Match, competition };
}
