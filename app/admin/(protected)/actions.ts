"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createEvent(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  if (!name || !eventDate) {
    throw new Error("Faltan datos del evento.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").insert({ name, event_date: eventDate });
  if (error) throw new Error(error.message);

  // A diferencia de antes, ya no redirige al detalle del evento recién
  // creado — se queda en el listado (con el evento nuevo ya agregado), que
  // es lo que se ve al cerrar el cuadro de alta.
  revalidatePath("/admin");
}

export async function setEventStatus(eventId: string, status: "draft" | "active" | "finished") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath(`/admin/eventos/${eventId}`);
}

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");

/** slug determinístico a partir del nombre: sin acentos, en minúscula,
 * separado por guiones bajos — igual convención que las disciplinas
 * seedeadas (ej. "sumo_autonomo"). */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function createDiscipline(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Falta el nombre de la disciplina.");
  const allowDrawsDefault = formData.get("allow_draws_default") === "on";

  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase.from("disciplines").select("slug");
  const existingSlugs = new Set((existing ?? []).map((d) => d.slug as string));

  const baseSlug = slugify(name) || "disciplina";
  let slug = baseSlug;
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}_${suffix++}`;
  }

  const { count } = await supabase.from("disciplines").select("id", { count: "exact", head: true });

  const { error } = await supabase.from("disciplines").insert({
    slug,
    name,
    allow_draws_default: allowDrawsDefault,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
