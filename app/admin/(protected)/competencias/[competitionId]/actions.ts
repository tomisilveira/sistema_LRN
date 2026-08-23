"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateRoundRobinPairs } from "@/lib/round-robin";
import { advanceWinner } from "@/lib/bracket-actions";
import { computeMatchOutcome } from "@/lib/match-logic";
import { generateBracketForCompetition } from "@/lib/generate-bracket-for-competition";
import { maybeAdvanceCompetitionPhase } from "@/lib/advance-competition-phase";
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
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim() || null;
  if (!name) throw new Error("Falta el nombre del equipo.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("teams").insert({ competition_id: competitionId, name, institution });
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
  const { error } = await supabase
    .from("teams")
    .update({ accredited: value, accredited_at: value ? new Date().toISOString() : null })
    .eq("id", teamId)
    .eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  revalidateCompetition(competitionId);
}

export async function setTeamHomologated(competitionId: string, teamId: string, value: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("teams")
    .update({ homologated: value, homologated_at: value ? new Date().toISOString() : null })
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
    const { data: team } = await supabase
      .from("teams")
      .select("accredited, homologated")
      .eq("id", teamId)
      .single();
    if (!team?.accredited || !team?.homologated) {
      throw new Error("Este equipo todavía no está acreditado y homologado — no puede entrar a un grupo.");
    }

    const { error } = await supabase.from("group_teams").insert({ group_id: groupId, team_id: teamId });
    if (error) throw new Error(error.message);
  }

  revalidateCompetition(competitionId);
}

export async function randomDraw(competitionId: string, formData: FormData) {
  const numGroups = Math.max(1, Number(formData.get("num_groups") ?? 1));
  const supabase = await createServerSupabaseClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("accredited", true)
    .eq("homologated", true);
  if (!teams || teams.length < 2) {
    throw new Error("Cargá al menos 2 equipos acreditados y homologados antes de sortear.");
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

  // Pedido explícito del usuario: no se puede iniciar el torneo mientras
  // queden equipos cargados sin asignar a un grupo (se resuelve desde la
  // pestaña Grupos) — este chequeo es el resguardo del lado del server, la
  // UI ya oculta el botón "Iniciar torneo" en ese caso.
  const { count: totalTeams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  const assignedTeamIds = new Set(
    (groups as unknown as { group_teams: { team_id: string }[] }[]).flatMap((g) =>
      g.group_teams.map((gt) => gt.team_id)
    )
  );
  if ((totalTeams ?? 0) > assignedTeamIds.size) {
    throw new Error(
      `Todavía hay ${(totalTeams ?? 0) - assignedTeamIds.size} equipo(s) sin asignar a un grupo — asignalos (o quitalos del torneo) desde la pestaña Grupos antes de iniciar.`
    );
  }

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

  await supabase.from("competitions").update({ status: "groups_in_progress" }).eq("id", competitionId);

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
