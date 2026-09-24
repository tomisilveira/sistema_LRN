"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperadmin } from "@/lib/admin-auth";
import type { AdminRole } from "@/lib/database.types";

// Alta y gestión de administradores — solo el superusuario. Usa la
// service-role key porque crear cuentas de Supabase Auth
// (auth.admin.createUser) y escribir `admins` no se puede con la sesión
// del usuario (no hay policy de escritura en `admins`, a propósito). Por
// eso CADA acción arranca con requireSuperadmin().

const MIN_PASSWORD = 8;

function parseRole(raw: FormDataEntryValue | null): AdminRole {
  return raw === "superadmin" ? "superadmin" : "event_admin";
}

function parsePassword(formData: FormData): string {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    throw new Error(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  return password;
}

function revalidateAll() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin", "layout");
}

/** Busca una cuenta de Auth por email (para re-habilitar a alguien que ya
 * tuvo cuenta y se le quitó el acceso). */
async function findAuthUserIdByEmail(supabase: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function createAdminUser(formData: FormData) {
  const me = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const role = parseRole(formData.get("role"));
  const password = parsePassword(formData);
  const eventIds = formData.getAll("event_ids").map(String).filter(Boolean);
  if (!email || !email.includes("@")) throw new Error("Falta un email válido.");

  const supabase = createAdminClient();

  // Cuenta de Auth: se crea ya confirmada (no manda mail — la contraseña se
  // la pasás vos). Si el email ya tenía cuenta (ej. se le quitó el acceso
  // antes), se reusa y se le pisa la contraseña.
  let userId: string | null = null;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    userId = await findAuthUserIdByEmail(supabase, email);
    if (!userId) throw new Error(createError?.message ?? "No se pudo crear la cuenta.");
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
  }

  const { data: existingAdmin } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (existingAdmin) throw new Error("Ese email ya es administrador — editalo desde la lista.");

  const { error: adminError } = await supabase
    .from("admins")
    .insert({ user_id: userId, full_name: fullName, email, role });
  if (adminError) throw new Error(adminError.message);

  if (eventIds.length > 0) {
    const { error } = await supabase
      .from("event_admins")
      .upsert(eventIds.map((eventId) => ({ event_id: eventId, user_id: userId, added_by: me.userId })));
    if (error) throw new Error(error.message);
  }

  revalidateAll();
}

/** Editar un administrador: nombre, rol y la lista de eventos que
 * administra (reemplaza la actual por la tildada). El rol propio no se
 * puede cambiar — te quedarías sin acceso a esta pantalla. */
export async function updateAdminUser(userId: string, formData: FormData) {
  const me = await requireSuperadmin();
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const role = parseRole(formData.get("role"));
  const wanted = new Set(formData.getAll("event_ids").map(String).filter(Boolean));

  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("admins")
    .update(userId === me.userId ? { full_name: fullName } : { full_name: fullName, role })
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);

  const { data: current } = await supabase.from("event_admins").select("event_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((r: { event_id: string }) => r.event_id));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("event_admins")
      .insert(toAdd.map((eventId) => ({ event_id: eventId, user_id: userId, added_by: me.userId })));
    if (error) throw new Error(error.message);
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("event_admins").delete().eq("user_id", userId).in("event_id", toRemove);
    if (error) throw new Error(error.message);
  }
  revalidateAll();
}

export async function setAdminPassword(userId: string, formData: FormData) {
  await requireSuperadmin();
  const password = parsePassword(formData);
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Le saca el acceso al panel (borra su fila de `admins` y, en cascada, de
 * qué eventos era administrador). La cuenta de Auth queda — si se lo vuelve
 * a dar de alta con el mismo email, se reusa. */
export async function removeAdminUser(userId: string) {
  const me = await requireSuperadmin();
  if (userId === me.userId) throw new Error("No podés quitarte el acceso a vos mismo.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("admins").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidateAll();
}
