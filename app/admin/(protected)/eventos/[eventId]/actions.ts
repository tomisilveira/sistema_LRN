"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-auth";

export async function addCourt(eventId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const disciplineId = String(formData.get("discipline_id") ?? "").trim() || null;
  if (!name) throw new Error("Falta el nombre de la cancha.");

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { error } = await supabase
    .from("courts")
    .insert({ event_id: eventId, name, discipline_id: disciplineId, sort_order: count ?? 0 });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventId}`);
}

export async function setCourtDiscipline(eventId: string, courtId: string, formData: FormData) {
  const disciplineId = String(formData.get("discipline_id") ?? "").trim() || null;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("courts")
    .update({ discipline_id: disciplineId })
    .eq("id", courtId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventId}`);
}

/** Borra una cancha. Los partidos que la tenían asignada quedan sin cancha
 * (ya es un estado soportado — "Sin cancha asignada"/turno null — igual que
 * cuando todavía no se asignó ninguna) en vez de bloquear el borrado;
 * `matches.court_id` no tiene ON DELETE CASCADE, así que hay que soltarlos
 * a mano antes de borrar la fila o Postgres rechaza el borrado por la FK. */
export async function deleteCourt(eventId: string, courtId: string) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("matches").update({ court_id: null, turno: null }).eq("court_id", courtId);
  const { error } = await supabase.from("courts").delete().eq("id", courtId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}`);
}

/** Borra el evento entero: torneos, canchas, equipos, grupos y partidos se
 * van con él (todos con ON DELETE CASCADE desde `events`/`competitions`, ver
 * 0001_init.sql) — irreversible, por eso el confirm fuerte en la UI. */
export async function deleteEvent(eventId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/publico");
  revalidatePath("/");
  redirect("/admin");
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
  const courtCountRaw = formData.get("court_count");

  if (!disciplineId || !categoryId) {
    throw new Error("Elegí disciplina y categoría.");
  }

  const supabase = await createServerSupabaseClient();

  // Las canchas son del evento (se comparten entre torneos de una misma
  // disciplina), pero recién se piden acá, al crear el primer torneo — que
  // es cuando ya sabés cuántas hacen falta. Si el evento todavía no tiene
  // ninguna, esta misma acción las crea antes de crear el torneo.
  const { count: existingCourts } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (!existingCourts) {
    const courtCount = Math.max(1, Math.min(20, Number(courtCountRaw ?? 0)));
    if (!courtCount) {
      throw new Error("Ingresá cuántas canchas hay disponibles hoy.");
    }
    // Las canchas creadas acá arrancan con la disciplina de este primer
    // torneo (es lo más probable) — el admin puede recolorearlas después
    // desde la sección de Canchas si en realidad son para otra disciplina.
    const courtRows = Array.from({ length: courtCount }, (_, i) => ({
      event_id: eventId,
      name: `Cancha ${i + 1}`,
      discipline_id: disciplineId,
      sort_order: i,
    }));
    const { error: courtsError } = await supabase.from("courts").insert(courtRows);
    if (courtsError) throw new Error(courtsError.message);
  }

  // Config de timer de la disciplina (rounds para sumo, períodos para
  // fútbol) — se copia como punto de partida del torneo, editable después
  // en "Formato del torneo" mientras siga en 'setup'.
  const { data: discipline } = await supabase
    .from("disciplines")
    .select("timer_mode_default, period_seconds_default, periods_count_default, rounds_to_win_default")
    .eq("id", disciplineId)
    .maybeSingle();

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
    timer_mode: discipline?.timer_mode_default ?? "periods",
    period_seconds: discipline?.period_seconds_default ?? null,
    periods_count: discipline?.periods_count_default ?? 1,
    rounds_to_win: discipline?.rounds_to_win_default ?? null,
  });
  if (error) {
    // 23505 = unique_violation — ya existe un torneo de esa disciplina ×
    // categoría en este evento (unique (event_id, discipline_id,
    // category_id), ver 0001_init.sql). Mensaje sin esto es un genérico de
    // Postgres ("duplicate key value violates constraint...") que en
    // producción termina mostrando un error críptico en vez de explicar
    // qué pasó.
    if (error.code === "23505") {
      throw new Error(
        "Ya existe un torneo de esa disciplina y categoría en este evento — entrá a ese torneo si querés cambiarle el formato, o elegí otra disciplina/categoría."
      );
    }
    throw new Error(error.message);
  }

  revalidatePath(`/admin/eventos/${eventId}`);
}

export async function setEventStatusAction(eventId: string, status: "draft" | "active" | "finished") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath("/admin");
}

/** Público/privado en la sección pública del sitio — independiente del
 * status. Requiere la migración 0005_event_visibility.sql corrida en
 * Supabase (columna events.is_public); si no está, esto tira un error de
 * columna inexistente. */
export async function setEventPublicAction(eventId: string, isPublic: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").update({ is_public: isPublic }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath("/admin");
  revalidatePath("/publico");
  revalidatePath("/");
}

/** Comparte el evento con otro administrador que ya exista. Corre con la
 * sesión del usuario: la RLS de event_admins (0018) solo lo deja si
 * administra este evento. */
export async function shareEvent(eventId: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) throw new Error("Elegí con quién compartirlo.");
  const admin = await getAdminContext();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("event_admins")
    .insert({ event_id: eventId, user_id: userId, added_by: admin?.userId ?? null });
  if (error) {
    if (error.code === "23505") throw new Error("Esa persona ya administra este evento.");
    throw new Error(error.message);
  }
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath("/admin/usuarios");
}

/** Deja de compartir el evento con alguien. Si es uno mismo (y no es
 * superusuario), pierde el acceso: se lo manda a la lista de eventos. */
export async function unshareEvent(eventId: string, userId: string) {
  const admin = await getAdminContext();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("event_admins").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin", "layout");
  if (admin && userId === admin.userId && !admin.isSuperadmin) redirect("/admin");
  revalidatePath(`/admin/eventos/${eventId}`);
}

function revalidateRegistration(eventId: string) {
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath(`/inscripcion/${eventId}`);
}

/** Abre/cierra la inscripción de un torneo desde la pestaña Inscripción del
 * evento. Un torneo terminado no se puede abrir (la inscripción pública
 * igual lo rechazaría, ver app/inscripcion/[eventId]/actions.ts). */
export async function setCompetitionRegistration(eventId: string, competitionId: string, open: boolean) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("competitions")
    .update({ registration_open: open })
    .eq("id", competitionId)
    .eq("event_id", eventId);
  if (open) query = query.neq("status", "finished");
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateRegistration(eventId);
}

/** "Abrir todos": solo los torneos que todavía no empezaron (status
 * 'setup') — abrir de golpe uno en curso sumaría equipos a un fixture ya
 * armado. "Cerrar todos": todos los abiertos. */
export async function setAllRegistrations(eventId: string, open: boolean) {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("competitions").update({ registration_open: open }).eq("event_id", eventId);
  query = open ? query.eq("status", "setup") : query.eq("registration_open", true);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateRegistration(eventId);
}
