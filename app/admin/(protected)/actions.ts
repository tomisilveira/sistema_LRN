"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createEvent(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  if (!name || !eventDate) {
    throw new Error("Faltan datos del evento.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ name, event_date: eventDate })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect(`/admin/eventos/${data.id}`);
}

export async function setEventStatus(eventId: string, status: "draft" | "active" | "finished") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath(`/admin/eventos/${eventId}`);
}
