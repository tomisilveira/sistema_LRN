import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./supabase/server";
import type { AdminRole } from "./database.types";

// Quién está usando el panel y qué puede hacer (ver
// supabase/migrations/0018_event_admins.sql). La RLS es la que realmente
// protege los datos; esto es para que la UI no ofrezca lo que la base va a
// rechazar (y para filtrar la lista de eventos: por RLS un event_admin
// también "ve" los eventos públicos ajenos, igual que cualquier visitante).

export interface AdminContext {
  userId: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  isSuperadmin: boolean;
}

/** Sesión + fila de `admins` del usuario actual, o null si no es admin.
 * Cacheado por request: layout, página y acciones lo piden sin repetir
 * consultas. */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  type Row = { role?: AdminRole | null; full_name: string | null; email?: string | null };
  const first = await supabase
    .from("admins")
    .select("role, full_name, email")
    .eq("user_id", claims.sub)
    .maybeSingle<Row>();
  let row = first.data;
  if (first.error) {
    // Base sin la migración 0018 (no existen role/email): se lee lo de
    // antes y todo admin sigue siendo "completo", como hasta ahora.
    ({ data: row } = await supabase
      .from("admins")
      .select("full_name")
      .eq("user_id", claims.sub)
      .maybeSingle<Row>());
  }
  if (!row) return null;

  const role: AdminRole = row.role ?? "superadmin";
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : (row.email ?? ""),
    fullName: row.full_name,
    role,
    isSuperadmin: role === "superadmin",
  };
});

/** Eventos que administra el usuario, en UNA tanda: usuario, eventos y
 * event_admins se piden a la vez y se filtra en memoria (antes eran 2-3
 * viajes en fila). La RLS de event_admins ya devuelve solo las filas de los
 * eventos que el usuario administra, así que no hace falta filtrar por
 * user_id. */
export async function listManageableEvents<T extends { id: string }>(
  supabase: SupabaseClient,
  columns: string
): Promise<{ admin: AdminContext | null; events: T[] }> {
  const [admin, { data: events }, { data: links }] = await Promise.all([
    getAdminContext(),
    supabase.from("events").select(columns).order("event_date", { ascending: false }),
    supabase.from("event_admins").select("event_id"),
  ]);
  if (!admin) return { admin: null, events: [] };
  const all = (events ?? []) as unknown as T[];
  if (admin.isSuperadmin) return { admin, events: all };
  const ids = new Set(((links ?? []) as { event_id: string }[]).map((l) => l.event_id));
  return { admin, events: all.filter((e) => ids.has(e.id)) };
}

// Si la función no existe (base sin la migración 0018, PostgREST responde
// PGRST202), se vuelve al modelo anterior: todo admin administra todo.
const FUNCTION_NOT_FOUND = "PGRST202";

export async function canManageEvent(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_manage_event", { p_event_id: eventId });
  if (error?.code === FUNCTION_NOT_FOUND) return !!(await getAdminContext());
  return data === true;
}

export async function canManageCompetition(supabase: SupabaseClient, competitionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_manage_competition", { p_competition_id: competitionId });
  if (error?.code === FUNCTION_NOT_FOUND) return !!(await getAdminContext());
  return data === true;
}

/** Para Server Actions reservadas al superusuario (usuarios, disciplinas,
 * categorías). Tira un error legible si no corresponde. */
export async function requireSuperadmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Tenés que iniciar sesión como administrador.");
  if (!ctx.isSuperadmin) throw new Error("Solo el superusuario puede hacer esto.");
  return ctx;
}
