"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function addCourt(eventId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Falta el nombre de la cancha.");

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { error } = await supabase
    .from("courts")
    .insert({ event_id: eventId, name, sort_order: count ?? 0 });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventId}`);
}

export async function createCompetition(eventId: string, formData: FormData) {
  const disciplineId = String(formData.get("discipline_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const formatType = String(formData.get("format_type") ?? "groups_only");
  const allowDraws = formData.get("allow_draws") === "on";
  const pointsWin = Number(formData.get("points_win") ?? 3);
  const pointsDraw = Number(formData.get("points_draw") ?? 1);
  const pointsLoss = Number(formData.get("points_loss") ?? 0);
  const qualifiersPerGroup = Number(formData.get("qualifiers_per_group") ?? 2);

  if (!disciplineId || !categoryId) {
    throw new Error("Elegí disciplina y categoría.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("competitions").insert({
    event_id: eventId,
    discipline_id: disciplineId,
    category_id: categoryId,
    format_type: formatType,
    allow_draws: allowDraws,
    points_win: pointsWin,
    points_draw: pointsDraw,
    points_loss: pointsLoss,
    qualifiers_per_group: qualifiersPerGroup,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventId}`);
}

export async function setEventStatusAction(eventId: string, status: "draft" | "active" | "finished") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath("/admin");
}
