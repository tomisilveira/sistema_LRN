import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Competition, TimeTrialRun } from "@/lib/database.types";

// Contrarreloj (seguidor de línea) desde la pantalla del juez. Igual que los
// endpoints de partidos, la única credencial es el access_token de la
// cancha: se valida que la cancha sea del mismo evento que el torneo.
//
// POST   → guarda el próximo intento de un robot (tiempo o "no terminó").
// DELETE → deshace el último intento cargado desde ESTA cancha (para un
//          toque equivocado), solo si es el último del torneo.

async function loadContext(courtToken: unknown, competitionId: unknown) {
  if (typeof courtToken !== "string" || !courtToken) return { error: "Falta el token de cancha.", status: 401 } as const;
  if (typeof competitionId !== "string" || !competitionId) return { error: "Falta el torneo.", status: 400 } as const;
  const supabase = createAdminClient();
  const [{ data: court }, { data: competition }] = await Promise.all([
    supabase.from("courts").select("id, event_id").eq("access_token", courtToken).maybeSingle(),
    supabase.from("competitions").select("*").eq("id", competitionId).maybeSingle<Competition>(),
  ]);
  if (!court) return { error: "Link de cancha inválido.", status: 401 } as const;
  if (!competition || competition.event_id !== court.event_id) {
    return { error: "Este torneo no es de tu evento.", status: 403 } as const;
  }
  if (competition.format_type !== "time_trial") {
    return { error: "Este torneo no es contrarreloj.", status: 400 } as const;
  }
  return { supabase, court, competition } as const;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    courtToken?: string;
    competitionId?: string;
    teamId?: string;
    timeMs?: number | null;
  } | null;

  const ctx = await loadContext(body?.courtToken, body?.competitionId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, court, competition } = ctx;

  if (competition.status === "setup") {
    return NextResponse.json({ error: "El torneo todavía no empezó: iniciarlo desde el panel." }, { status: 400 });
  }
  if (competition.status === "finished") {
    return NextResponse.json({ error: "El torneo ya terminó." }, { status: 400 });
  }

  const teamId = body?.teamId;
  if (!teamId) return NextResponse.json({ error: "Falta el robot." }, { status: 400 });

  let timeMs = body?.timeMs ?? null;
  if (timeMs !== null && (!Number.isFinite(timeMs) || timeMs <= 0)) {
    return NextResponse.json({ error: "El tiempo no es válido." }, { status: 400 });
  }
  // Pasado el tiempo máximo, el intento cuenta como "no terminó".
  if (timeMs !== null && competition.period_seconds && timeMs > competition.period_seconds * 1000) {
    timeMs = null;
  }

  const [{ data: team }, { data: previous }] = await Promise.all([
    supabase.from("teams").select("id, competition_id, withdrawn_at").eq("id", teamId).maybeSingle(),
    supabase.from("time_trial_runs").select("attempt").eq("team_id", teamId).order("attempt", { ascending: false }),
  ]);
  if (!team || team.competition_id !== competition.id) {
    return NextResponse.json({ error: "El robot no es de este torneo." }, { status: 400 });
  }
  if (team.withdrawn_at) {
    return NextResponse.json({ error: "Este robot está dado de baja: no corre más." }, { status: 400 });
  }
  const used = previous?.length ?? 0;
  if (used >= competition.periods_count) {
    return NextResponse.json({ error: "Este robot ya usó todos sus intentos." }, { status: 400 });
  }

  const { data: run, error } = await supabase
    .from("time_trial_runs")
    .insert({
      competition_id: competition.id,
      team_id: teamId,
      attempt: (previous?.[0]?.attempt ?? 0) + 1,
      time_ms: timeMs === null ? null : Math.round(timeMs),
      finished: timeMs !== null,
      court_id: court.id,
    })
    .select("*")
    .single<TimeTrialRun>();
  if (error) {
    // unique (team_id, attempt): dos tablets guardando el mismo intento a la vez.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ese intento ya se cargó desde otra pantalla. Recargá." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, run });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    courtToken?: string;
    competitionId?: string;
    runId?: string;
  } | null;

  const ctx = await loadContext(body?.courtToken, body?.competitionId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, court, competition } = ctx;

  const { data: last } = await supabase
    .from("time_trial_runs")
    .select("id, court_id")
    .eq("competition_id", competition.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || last.id !== body?.runId) {
    return NextResponse.json({ error: "Solo se puede deshacer el último intento cargado." }, { status: 400 });
  }
  if (last.court_id !== court.id) {
    return NextResponse.json({ error: "Ese intento se cargó desde otra cancha." }, { status: 403 });
  }

  const { error } = await supabase.from("time_trial_runs").delete().eq("id", last.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
