"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Falta el nombre de la categoría.");
  const minAgeRaw = String(formData.get("min_age") ?? "").trim();
  const maxAgeRaw = String(formData.get("max_age") ?? "").trim();

  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase.from("categories").select("slug");
  const existingSlugs = new Set((existing ?? []).map((c) => c.slug as string));

  const baseSlug = slugify(name) || "categoria";
  let slug = baseSlug;
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}_${suffix++}`;
  }

  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });

  const { error } = await supabase.from("categories").insert({
    slug,
    name,
    min_age: minAgeRaw ? Number(minAgeRaw) : null,
    max_age: maxAgeRaw ? Number(maxAgeRaw) : null,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/categorias");
}

/** Nombre y franja etaria son editables en cualquier momento — a diferencia
 * del slug, que queda fijo desde la creación (no se usa para mostrar nada,
 * solo como referencia interna, así que no hace falta poder cambiarlo). */
export async function updateCategory(categoryId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Falta el nombre de la categoría.");
  const minAgeRaw = String(formData.get("min_age") ?? "").trim();
  const maxAgeRaw = String(formData.get("max_age") ?? "").trim();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name,
      min_age: minAgeRaw ? Number(minAgeRaw) : null,
      max_age: maxAgeRaw ? Number(maxAgeRaw) : null,
    })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/categorias");
}

/** Borra una categoría — bloqueado por la base (FK sin ON DELETE CASCADE,
 * ver 0001_init.sql) si todavía hay algún torneo usándola, con un mensaje
 * claro en vez del error crudo de Postgres. Para poder borrarla hay que
 * mover o borrar antes esos torneos (ver moveTeamToCompetition en
 * competencias/[competitionId]/actions.ts para mover los equipos sin
 * volver a cargarlos). */
export async function deleteCategory(categoryId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Esta categoría todavía tiene torneos que la usan — moveé o borrá esos torneos antes de borrarla."
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/categorias");
}
