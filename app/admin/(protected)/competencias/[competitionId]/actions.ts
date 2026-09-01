"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateRoundRobinPairs } from "@/lib/round-robin";
import { advanceWinner } from "@/lib/bracket-actions";
import { computeMatchOutcome } from "@/lib/match-logic";
import { generateBracketForCompetition, ensureThirdPlaceMatch } from "@/lib/generate-bracket-for-competition";
import { maybeAdvanceCompetitionPhase } from "@/lib/advance-competition-phase";
import { parseTeamInput, parseMentorInput, isFutbolCompetition } from "@/lib/team-input";
import { autoScheduleAndPersist } from "@/lib/apply-auto-schedule";
import type { SchedulableMatch } from "@/lib/auto-schedule";
import type { Competition, Match } from "@/lib/database.types";

function revalidateCompetition(competitionId: string) {
  revalidatePath(`/admin/competencias/${competitionId}`);
  revalidatePath(`/publico`);
}

export async function updateCompetitionFormat(competitionId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("status")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");
  if (competition.status !== "setup") {
    throw new Error("Ya se generaron los partidos de grupo; no se puede cambiar el formato ahora.");
  }

  const formatType = String(formData.get("format_type") ?? "groups_only");
  const allowDraws = formData.get("allow_draws") === "on";
  const pointsWin = Number(formData.get("points_win") ?? 3);
  const pointsDraw = Number(formData.get("points_draw") ?? 1);
  const pointsLoss = Number(formData.get("points_loss") ?? 0);
  const qualifiersPerGroup = Number(formData.get("qualifiers_per_group") ?? 2);

  const timerMode = String(formData.get("timer_mode") ?? "periods");
  if (timerMode !== "periods" && timerMode !== "rounds") {
    throw new Error("Modo de timer inválido.");
  }
  const periodSecondsRaw = formData.get("period_seconds");
  const periodSeconds = periodSecondsRaw && String(periodSecondsRaw).trim() !== "" ? Number(periodSecondsRaw) : null;
  const periodsCount = Math.max(1, Number(formData.get("periods_count") ?? 1));
  const roundsToWinRaw = formData.get("rounds_to_win");
  const roundsToWin =
    timerMode === "rounds" && roundsToWinRaw && String(roundsToWinRaw).trim() !== ""
      ? Number(roundsToWinRaw)
      : null;
  if (timerMode === "rounds" && (!roundsToWin || roundsToWin < 1)) {
    throw new Error("Definí cuántos rounds ganados definen el partido.");
  }

  const { error } = await supabase
    .from("competitions")
    .update({
      format_type: formatType,
      allow_draws: allowDraws,
      points_win: pointsWin,
      points_draw: pointsDraw,
      points_loss: pointsLoss,
      qualifiers_per_group: qualifiersPerGroup,
      timer_mode: timerMode,
      period_seconds: periodSeconds,
      periods_count: periodsCount,
      rounds_to_win: roundsToWin,
    })
    .eq("id", competitionId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

export async function setRegistrationOpen(competitionId: string, open: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("competitions")
    .update({ registration_open: open })
    .eq("id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

/** Borra el torneo entero: equipos, grupos y partidos se van con él (todos
 * con ON DELETE CASCADE desde `competitions`, ver 0001_init.sql) —
 * irreversible, por eso el confirm fuerte en la UI. */
export async function deleteCompetition(competitionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("event_id")
    .eq("id", competitionId)
    .maybeSingle<Pick<Competition, "event_id">>();
  if (!competition) throw new Error("Competencia no encontrada.");

  const { error } = await supabase.from("competitions").delete().eq("id", competitionId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${competition.event_id}`);
  revalidatePath("/admin");
  revalidatePath("/publico");
  revalidatePath("/");
  redirect(`/admin/eventos/${competition.event_id}`);
}

export async function addTeam(competitionId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const isFutbol = await isFutbolCompetition(supabase, competitionId);
  const input = parseTeamInput(formData, { isFutbol });
  // Datos del responsable adulto — opcionales en el alta del admin (se
  // pueden completar después), obligatorios en la inscripción pública y en
  // la mesa de acreditación.
  const { mentorName, mentorContact } = parseMentorInput(formData);

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    name: input.name,
    institution: input.institution,
    mentor_name: mentorName,
    mentor_contact: mentorContact,
    member_count: input.memberCount,
    member_names: input.memberNames,
    robot_names: input.robotNames,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

/** Edita un equipo ya cargado (nombre, robots, institución, integrantes y
 * notas) — mismas reglas que `addTeam` vía parseTeamInput (1..4 integrantes,
 * 2 robots en fútbol). `member_count` sale de la lista de integrantes, no se
 * pide aparte. No toca mentor_name/mentor_contact: quedaron con formatos
 * mezclados entre equipos cargados antes y después de separar celular/email
 * (ver registration-form.tsx), así que forzar ese campo acá podría pisar
 * datos válidos con un parseo adivinado. */
export async function updateTeam(competitionId: string, teamId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const isFutbol = await isFutbolCompetition(supabase, competitionId);
  const input = parseTeamInput(formData, { isFutbol });

  const { error } = await supabase
    .from("teams")
    .update({
      name: input.name,
      institution: input.institution,
      member_count: input.memberCount,
      member_names: input.memberNames,
      robot_names: input.robotNames,
      notes: input.notes,
    })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

export async function removeTeam(competitionId: string, teamId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

/**
 * Acreditar/homologar equipos desde el panel admin — mismo par de flags que
 * la mesa de acreditación pública (app/acreditacion/[eventToken]), pero acá
 * con la sesión de admin en vez del token del evento, para no obligar a
 * abrir ese link aparte cuando ya se está en el torneo. `.eq("competition_id",
 * competitionId)` de más, por las dudas de que el teamId no corresponda a
 * este torneo.
 */
export async function setTeamAccredited(competitionId: string, teamId: string, value: boolean) {
  const supabase = await createServerSupabaseClient();

  // Invariante: homologado ⟹ acreditado — al quitar la acreditación se
  // quita también la homologación (misma regla que la mesa de acreditación).
  const patch: Record<string, unknown> = {
    accredited: value,
    accredited_at: value ? new Date().toISOString() : null,
  };
  if (!value) {
    patch.homologated = false;
    patch.homologated_at = null;
  }

  const { error } = await supabase
    .from("teams")
    .update(patch)
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

export async function setTeamHomologated(competitionId: string, teamId: string, value: boolean) {
  const supabase = await createServerSupabaseClient();

  if (value) {
    const { data: team } = await supabase
      .from("teams")
      .select("accredited")
      .eq("id", teamId)
      .eq("competition_id", competitionId)
      .maybeSingle<{ accredited: boolean }>();
    if (!team?.accredited) {
      throw new Error("Primero acreditá al equipo — no se puede homologar sin acreditación.");
    }
  }

  const { error } = await supabase
    .from("teams")
    .update({ homologated: value, homologated_at: value ? new Date().toISOString() : null })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

/** Editar los nombres de las personas de un equipo desde el panel admin —
 * mismo campo que carga el propio equipo al inscribirse (ver
 * app/inscripcion/[competitionId]/actions.ts), acá para poder corregirlo o
 * completarlo cuando el equipo lo cargó a mano en la mesa de acreditación
 * en vez de por el form público. */
export async function setTeamMemberNames(competitionId: string, teamId: string, formData: FormData) {
  const raw = String(formData.get("member_names") ?? "").trim();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("teams")
    .update({ member_names: raw || null })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

export async function setTeamParticipantsPresent(competitionId: string, teamId: string, formData: FormData) {
  const raw = String(formData.get("participants_present") ?? "").trim();
  const value = raw === "" ? null : Math.max(0, Number(raw));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("teams")
    .update({ participants_present: value })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

export async function createGroup(competitionId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Falta el nombre del grupo.");

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("groups")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  const { error } = await supabase
    .from("groups")
    .insert({ competition_id: competitionId, name, sort_order: count ?? 0 });
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

export async function assignTeamToGroup(competitionId: string, teamId: string, groupId: string) {
  const supabase = await createServerSupabaseClient();

  // Un equipo pertenece a un solo grupo dentro de la competencia: se borra
  // cualquier asignación previa antes de insertar la nueva.
  const { data: groupIds } = await supabase
    .from("groups")
    .select("id")
    .eq("competition_id", competitionId);
  const ids = (groupIds ?? []).map((g) => g.id);
  if (ids.length > 0) {
    await supabase.from("group_teams").delete().eq("team_id", teamId).in("group_id", ids);
  }

  if (groupId) {
    // Un equipo NO listo (falta acreditar y/o homologar) no puede entrar a
    // ningún grupo. Queda "fuera de los grupos" hasta que la mesa lo deje
    // listo; recién ahí se elige su grupo (y después "Armar partidos que
    // falten" si el torneo ya arrancó). Igual se puede lanzar el torneo con
    // equipos afuera — simplemente no juegan hasta sumarse.
    const { data: team } = await supabase
      .from("teams")
      .select("accredited, homologated")
      .eq("id", teamId)
      .eq("competition_id", competitionId)
      .single();
    if (!team?.accredited || !team?.homologated) {
      throw new Error(
        "Este equipo todavía no está listo (falta acreditar y/o homologar) — no puede entrar a un grupo."
      );
    }
    const { error } = await supabase.from("group_teams").insert({ group_id: groupId, team_id: teamId });
    if (error) throw new Error(error.message);
  }

  revalidateCompetition(competitionId);
}

export async function randomDraw(competitionId: string, formData: FormData) {
  const numGroups = Math.max(1, Number(formData.get("num_groups") ?? 1));
  const supabase = await createServerSupabaseClient();

  // Sólo se sortean los equipos LISTOS (acreditados + homologados). Los que
  // todavía no lo están quedan fuera de los grupos; cuando la mesa los deje
  // listos se les asigna grupo a mano (y "Armar partidos que falten" si el
  // torneo ya arrancó).
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("accredited", true)
    .eq("homologated", true);
  if (!teams || teams.length < 2) {
    throw new Error("Necesitás al menos 2 equipos listos (acreditados y homologados) para sortear.");
  }

  const { data: existingGroups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", competitionId)
    .order("sort_order");

  // Reutiliza los grupos existentes en orden; crea los que falten (A, B, C...).
  const letters = "ABCDEFGHIJ";
  const groupIds: string[] = (existingGroups ?? []).map((g) => g.id);
  for (let i = groupIds.length; i < numGroups; i++) {
    const { data, error } = await supabase
      .from("groups")
      .insert({ competition_id: competitionId, name: `Grupo ${letters[i] ?? i + 1}`, sort_order: i })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    groupIds.push(data.id);
  }
  const activeGroupIds = groupIds.slice(0, numGroups);

  // Limpia asignaciones previas y reparte al azar en partes iguales.
  await supabase.from("group_teams").delete().in("group_id", groupIds);

  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rows = shuffled.map((t, i) => ({
    team_id: t.id,
    group_id: activeGroupIds[i % activeGroupIds.length],
  }));
  const { error } = await supabase.from("group_teams").insert(rows);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

/**
 * Arranca el torneo: genera todos-contra-todos de cada grupo y le asigna
 * cancha + turno a cada partido automáticamente (ver lib/auto-schedule.ts)
 * — nada para asignar a mano. Solo se puede llamar una vez (mientras no
 * haya partidos ya generados); para volver a armar el fixture hay que
 * reiniciar el torneo primero.
 */
export async function startTournament(competitionId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");
  if (competition.format_type === "bracket_only") {
    throw new Error("Este torneo es \"solo cuadro\" — no tiene fase de grupos, generá el cuadro directo desde la pestaña Cuadro.");
  }

  const { count: existingMatches } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  if (existingMatches) {
    throw new Error("Este torneo ya tiene partidos generados — reiniciá el torneo antes de volver a armarlo.");
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, group_teams(team_id)")
    .eq("competition_id", competitionId);

  if (!groups || groups.length === 0) throw new Error("Creá los grupos y asigná equipos primero.");

  // Los equipos que quedaron sin grupo NO bloquean el arranque: se juega
  // con lo que esté asignado y los que falten se suman después con "Armar
  // partidos que falten" (ver syncGroupFixture). Antes esto era un error
  // duro.

  const rows: Partial<Match>[] = [];
  for (const g of groups as unknown as { id: string; group_teams: { team_id: string }[] }[]) {
    const teamIds = g.group_teams.map((gt) => gt.team_id);
    if (teamIds.length < 2) continue;
    for (const [a, b] of generateRoundRobinPairs(teamIds)) {
      rows.push({
        competition_id: competitionId,
        phase: "group",
        group_id: g.id,
        team_a_id: a,
        team_b_id: b,
        status: "scheduled",
      });
    }
  }
  if (rows.length === 0) throw new Error("Ningún grupo tiene equipos suficientes todavía.");

  const { data: inserted, error } = await supabase.from("matches").insert(rows).select("id, team_a_id, team_b_id");
  if (error) throw new Error(error.message);

  await autoScheduleAndPersist(
    supabase,
    competition.event_id,
    competition.discipline_id,
    (inserted ?? []) as SchedulableMatch[]
  );

  // Se cierra la inscripción sola acá — una vez armado el fixture, un
  // equipo nuevo ya no entraría a ningún grupo (ver
  // app/inscripcion/[competitionId]/page.tsx, que igual re-chequea el
  // status por si el admin la había dejado abierta de antes).
  await supabase
    .from("competitions")
    .update({ status: "groups_in_progress", registration_open: false })
    .eq("id", competitionId);

  revalidateCompetition(competitionId);
}

/**
 * Reinicia el torneo: borra TODOS sus partidos (grupo y cuadro, con sus
 * resultados) y vuelve el estado a "setup". No toca equipos ni grupos —
 * solo lo que dependía de "Iniciar torneo" para atrás, para poder
 * corregir algo y volver a arrancar sin perder la inscripción/sorteo.
 */
export async function restartTournament(competitionId: string) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("matches").delete().eq("competition_id", competitionId);
  if (error) throw new Error(error.message);

  const { error: statusError } = await supabase
    .from("competitions")
    .update({ status: "setup" })
    .eq("id", competitionId);
  if (statusError) throw new Error(statusError.message);

  revalidateCompetition(competitionId);
}

/**
 * "Armar partidos que falten": después de sumar equipos tarde (inscripción
 * reabierta + asignados a un grupo), genera SÓLO los partidos nuevos del
 * round-robin de cada grupo, sin tocar los ya jugados. También limpia los
 * partidos todavía no jugados de equipos que se sacaron de un grupo.
 *
 * A diferencia de `restartTournament`, no borra resultados. Sólo corre con
 * el torneo ya arrancado en fase de grupos.
 */
export async function syncGroupFixture(competitionId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, status, event_id, discipline_id")
    .eq("id", competitionId)
    .single<Pick<Competition, "id" | "status" | "event_id" | "discipline_id">>();
  if (!competition) throw new Error("Competencia no encontrada.");
  if (competition.status === "setup") {
    throw new Error("El torneo todavía no arrancó — usá “Iniciar torneo”.");
  }
  if (competition.status !== "groups_in_progress" && competition.status !== "groups_done") {
    throw new Error(
      "La fase de grupos ya está cerrada (o el torneo terminó). Reiniciá el torneo si necesitás rearmar el fixture."
    );
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, group_teams(team_id)")
    .eq("competition_id", competitionId);
  if (!groups || groups.length === 0) throw new Error("Este torneo no tiene grupos.");

  const { data: groupMatches } = await supabase
    .from("matches")
    .select("id, group_id, team_a_id, team_b_id, status")
    .eq("competition_id", competitionId)
    .eq("phase", "group");

  const pairKey = (a: string, b: string) => [a, b].sort().join("::");

  const rowsToInsert: Partial<Match>[] = [];
  const matchIdsToDelete: string[] = [];

  for (const g of groups as unknown as { id: string; group_teams: { team_id: string }[] }[]) {
    const teamIds = g.group_teams.map((gt) => gt.team_id);
    const teamIdSet = new Set(teamIds);
    const existing = (groupMatches ?? []).filter((m) => m.group_id === g.id);

    const existingPairs = new Set(
      existing
        .filter((m) => m.team_a_id && m.team_b_id)
        .map((m) => pairKey(m.team_a_id as string, m.team_b_id as string))
    );

    // Partidos sin jugar de equipos que ya no están en el grupo → se sueltan.
    for (const m of existing) {
      const stillHere = m.team_a_id && m.team_b_id && teamIdSet.has(m.team_a_id) && teamIdSet.has(m.team_b_id);
      if (!stillHere && m.status !== "completed") matchIdsToDelete.push(m.id);
    }

    // Pares del round-robin que todavía no tienen partido.
    for (const [a, b] of generateRoundRobinPairs(teamIds)) {
      if (existingPairs.has(pairKey(a, b))) continue;
      rowsToInsert.push({
        competition_id: competitionId,
        phase: "group",
        group_id: g.id,
        team_a_id: a,
        team_b_id: b,
        status: "scheduled",
      });
    }
  }

  if (matchIdsToDelete.length > 0) {
    const { error } = await supabase.from("matches").delete().in("id", matchIdsToDelete);
    if (error) throw new Error(error.message);
  }

  if (rowsToInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("matches")
      .insert(rowsToInsert)
      .select("id, team_a_id, team_b_id");
    if (error) throw new Error(error.message);

    await autoScheduleAndPersist(
      supabase,
      competition.event_id,
      competition.discipline_id,
      (inserted ?? []) as SchedulableMatch[]
    );
  }

  revalidateCompetition(competitionId);
}

/**
 * Elimina un grupo. Sus equipos quedan sin grupo (siguen cargados en el
 * torneo); `group_teams` y los partidos de ese grupo se van por FK
 * `on delete cascade` (ver 0001_init.sql). Si un grupo vacío se elimina, no
 * pasa nada. El confirm de la UI avisa cuando hay partidos que se pierden.
 */
export async function deleteGroup(competitionId: string, groupId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (!group) throw new Error("Grupo no encontrado en este torneo.");

  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);

  // Renumera sort_order de los que quedan (0,1,2...) para que "Grupo A/B/C"
  // no queden con huecos raros en el orden.
  const { data: remaining } = await supabase
    .from("groups")
    .select("id")
    .eq("competition_id", competitionId)
    .order("sort_order");
  await Promise.all(
    (remaining ?? []).map((g, i) => supabase.from("groups").update({ sort_order: i }).eq("id", g.id))
  );

  revalidateCompetition(competitionId);
}

export async function assignSchedule(competitionId: string, matchId: string, formData: FormData) {
  const courtId = String(formData.get("court_id") ?? "") || null;
  const turnoRaw = formData.get("turno");
  const turno = turnoRaw ? Number(turnoRaw) : null;

  const supabase = await createServerSupabaseClient();

  if (turno !== null) {
    const { data: match } = await supabase
      .from("matches")
      .select("team_a_id, team_b_id, competitions!inner(event_id)")
      .eq("id", matchId)
      .single<{ team_a_id: string; team_b_id: string; competitions: { event_id: string } }>();

    if (match) {
      const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean);
      const { data: conflicts } = await supabase
        .from("matches")
        .select("id, team_a_id, team_b_id, competitions!inner(event_id)")
        .eq("turno", turno)
        .eq("competitions.event_id", match.competitions.event_id)
        .neq("id", matchId);

      const hasConflict = (conflicts ?? []).some(
        (m) => teamIds.includes(m.team_a_id) || teamIds.includes(m.team_b_id)
      );
      if (hasConflict) {
        throw new Error(
          "Choque de horario: uno de estos equipos ya tiene otro partido asignado en ese turno."
        );
      }
    }
  }

  const { error } = await supabase
    .from("matches")
    .update({ court_id: courtId, turno })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

export async function submitResult(competitionId: string, matchId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single<Match>();
  if (!match) throw new Error("Partido no encontrado.");

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");
  if (!match.team_a_id || !match.team_b_id) throw new Error("Todavía no están definidos los dos equipos.");

  const scoreARaw = formData.get("score_a");
  const scoreBRaw = formData.get("score_b");
  const winnerIdIfNoScore = String(formData.get("winner_id") ?? "") || null;

  const outcome = computeMatchOutcome({
    allowDraws: competition.allow_draws,
    teamAId: match.team_a_id,
    teamBId: match.team_b_id,
    scoreA: scoreARaw !== null && scoreARaw !== "" ? Number(scoreARaw) : null,
    scoreB: scoreBRaw !== null && scoreBRaw !== "" ? Number(scoreBRaw) : null,
    winnerIdIfNoScore,
  });

  const { data: updated, error } = await supabase
    .from("matches")
    .update({
      score_a: scoreARaw !== null && scoreARaw !== "" ? Number(scoreARaw) : null,
      score_b: scoreBRaw !== null && scoreBRaw !== "" ? Number(scoreBRaw) : null,
      winner_id: outcome.winner_id,
      status: outcome.status,
    })
    .eq("id", matchId)
    .select("*")
    .single<Match>();
  if (error) throw new Error(error.message);

  if (updated.phase === "bracket") {
    await advanceWinner(supabase, updated);
  }
  await maybeAdvanceCompetitionPhase(supabase, competitionId);

  revalidateCompetition(competitionId);
}

export async function setManualRankOverride(
  competitionId: string,
  groupId: string,
  teamId: string,
  formData: FormData
) {
  const raw = String(formData.get("rank") ?? "").trim();
  const rank = raw === "" ? null : Number(raw);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("group_teams")
    .update({ manual_rank_override: rank })
    .eq("group_id", groupId)
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}

/**
 * Genera el/los cuadro(s) de eliminación que correspondan según el
 * `format_type` de la competencia (ver generateBracketForCompetition). Es
 * idempotente por `bracket_type`, así que se puede volver a invocar sin
 * problema — por ejemplo si en 'gold_silver' la copa oro ya se generó (por
 * el avance automático) y solo falta la plata.
 */
export async function generateBracket(competitionId: string) {
  const supabase = await createServerSupabaseClient();
  await generateBracketForCompetition(supabase, competitionId);
  revalidateCompetition(competitionId);
}

/**
 * Se asegura de que el cuadro tenga el partido por el 3er puesto (obligatorio
 * en todo cuadro con semifinales). Para cuadros generados antes de la
 * migración 0014 que no lo traen — la pantalla del torneo la llama sola al
 * abrirse (ver ensure-third-place.tsx). Si el torneo ya estaba "Terminado",
 * lo reabre a "Eliminatoria en curso" hasta que se juegue ese partido. No
 * tira error si no había nada que hacer.
 */
export async function ensureThirdPlaceMatchAction(competitionId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("status")
    .eq("id", competitionId)
    .maybeSingle<Pick<Competition, "status">>();
  if (!competition) return;

  const created = await ensureThirdPlaceMatch(supabase, competitionId);
  if (!created) return;

  if (competition.status === "finished") {
    await supabase.from("competitions").update({ status: "bracket_in_progress" }).eq("id", competitionId);
  }

  revalidateCompetition(competitionId);
}

/**
 * Mueve un equipo a otro torneo del MISMO evento — para unificar o dividir
 * categorías (o corregir una disciplina/categoría mal elegida) sin tener
 * que volver a cargar el equipo: nombre, robots, integrantes, acreditación
 * y notas viajan con él. Solo se puede mientras el equipo TODAVÍA no jugó
 * ningún partido acá (si el torneo ya arrancó, primero hay que reiniciarlo
 * — se pierden esos resultados) y el torneo de destino sigue en "setup"
 * (si ya tiene fixture armado, un equipo nuevo no entraría a ningún grupo).
 * Sale del grupo/semilla que tenía acá; en el destino llega sin grupo
 * asignado, igual que un equipo recién cargado a mano.
 */
export async function moveTeamToCompetition(competitionId: string, teamId: string, targetCompetitionId: string) {
  if (!targetCompetitionId) return; // opción "Mover a otro torneo…" (placeholder) vuelta a elegir

  const supabase = await createServerSupabaseClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (!team) throw new Error("Equipo no encontrado en este torneo.");

  const { count: matchesHere } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
  if (matchesHere) {
    throw new Error("Este equipo ya tiene partidos generados acá — reiniciá el torneo antes de moverlo.");
  }

  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("competitions").select("event_id").eq("id", competitionId).single(),
    supabase.from("competitions").select("id, event_id, status").eq("id", targetCompetitionId).maybeSingle(),
  ]);
  if (!target) throw new Error("Torneo de destino no encontrado.");
  if (!source || source.event_id !== target.event_id) {
    throw new Error("Solo se puede mover a otro torneo del mismo evento.");
  }
  if (target.status !== "setup") {
    throw new Error("El torneo de destino ya arrancó — reiniciálo antes de recibir equipos nuevos.");
  }

  const { data: groupIds } = await supabase.from("groups").select("id").eq("competition_id", competitionId);
  const ids = (groupIds ?? []).map((g) => g.id);
  if (ids.length > 0) {
    await supabase.from("group_teams").delete().eq("team_id", teamId).in("group_id", ids);
  }

  const { error } = await supabase
    .from("teams")
    .update({ competition_id: targetCompetitionId, seed_order: null })
    .eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
  revalidatePath(`/admin/competencias/${targetCompetitionId}`);
}

/**
 * Fusiona ESTE torneo con otro del mismo evento: mueve TODOS sus equipos
 * de una — pedido explícito, en vez de repetir "Mover a otro torneo" fila
 * por fila cuando son muchos equipos. Mismas reglas de seguridad que
 * moveTeamToCompetition (ningún equipo puede tener partidos generados acá,
 * el destino tiene que seguir en "setup"), chequeadas una sola vez para
 * todo el torneo. El torneo de origen queda vacío (0 equipos) pero NO se
 * borra solo — a propósito, para no tomar esa decisión por el admin; si ya
 * no hace falta, lo borra a mano con "🗑️ Eliminar torneo".
 */
export async function mergeCompetitionTeams(competitionId: string, targetCompetitionId: string) {
  if (!targetCompetitionId) return;

  const supabase = await createServerSupabaseClient();

  const { count: matchesHere } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  if (matchesHere) {
    throw new Error("Este torneo ya tiene partidos generados — reiniciálo antes de fusionarlo.");
  }

  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("competitions").select("event_id").eq("id", competitionId).single(),
    supabase.from("competitions").select("id, event_id, status").eq("id", targetCompetitionId).maybeSingle(),
  ]);
  if (!target) throw new Error("Torneo de destino no encontrado.");
  if (!source || source.event_id !== target.event_id) {
    throw new Error("Solo se puede fusionar con otro torneo del mismo evento.");
  }
  if (target.status !== "setup") {
    throw new Error("El torneo de destino ya arrancó — reiniciálo antes de recibir estos equipos.");
  }

  const { data: teams } = await supabase.from("teams").select("id").eq("competition_id", competitionId);
  const teamIds = (teams ?? []).map((t) => t.id);
  if (teamIds.length === 0) throw new Error("Este torneo no tiene equipos para mover.");

  const { data: groupIds } = await supabase.from("groups").select("id").eq("competition_id", competitionId);
  const ids = (groupIds ?? []).map((g) => g.id);
  if (ids.length > 0) {
    await supabase.from("group_teams").delete().in("team_id", teamIds).in("group_id", ids);
  }

  const { error } = await supabase
    .from("teams")
    .update({ competition_id: targetCompetitionId, seed_order: null })
    .in("id", teamIds);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
  revalidatePath(`/admin/competencias/${targetCompetitionId}`);
  return teamIds.length;
}

/** Orden de siembra manual de un equipo, solo usado en `format_type =
 * 'bracket_only'` (cuadro sin fase de grupos) — ver
 * generateBracketForCompetition. Vacío = sin semilla forzada, se ordena por
 * fecha de carga. */
export async function setTeamSeed(competitionId: string, teamId: string, formData: FormData) {
  const raw = String(formData.get("seed") ?? "").trim();
  const seed = raw === "" ? null : Number(raw);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("teams")
    .update({ seed_order: seed })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);

  revalidateCompetition(competitionId);
}
