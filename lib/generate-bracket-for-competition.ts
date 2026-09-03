import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeedOrder, generateBracketRounds } from "./bracket";
import { persistBracket } from "./bracket-actions";
import { autoScheduleAndPersist } from "./apply-auto-schedule";
import type { SchedulableMatch } from "./auto-schedule";
import type { BracketType, Competition, GroupStandingRow, Match, Team } from "./database.types";

type StandingsSelector = (standings: GroupStandingRow[]) => GroupStandingRow[];

/** ¿Ya existe un cuadro de este `bracket_type` para la competencia? Se
 * chequea por tipo (no por `phase='bracket'` en general) para poder generar
 * oro y plata de forma independiente sin bloquearse entre sí. */
async function bracketExists(
  supabase: SupabaseClient,
  competitionId: string,
  bracketType: BracketType | null
): Promise<boolean> {
  const base = supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("phase", "bracket");
  const { count } = bracketType ? await base.eq("bracket_type", bracketType) : await base.is("bracket_type", null);
  return (count ?? 0) > 0;
}

/** Trae la tabla de posiciones de cada grupo y aplica `select` para decidir
 * qué filas entran al cuadro — top N clasificados para la copa oro,
 * el resto (sobrantes) para la copa plata. */
async function collectGroupSeeds(supabase: SupabaseClient, competitionId: string, select: StandingsSelector) {
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("competition_id", competitionId)
    .order("sort_order");
  if (!groups || groups.length === 0) throw new Error("No hay grupos cargados.");

  const qualifiersByGroup = [];
  for (const g of groups) {
    const { data: standings, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
    if (error) throw new Error(error.message);
    const rows = select((standings ?? []) as GroupStandingRow[]);
    qualifiersByGroup.push({
      groupName: g.name,
      teams: rows.map((r, i) => ({ teamId: r.team_id, teamName: r.team_name, rank: i + 1 })),
    });
  }
  return qualifiersByGroup;
}

/** Arma y persiste un cuadro a partir de la tabla de posiciones de los
 * grupos. No hace nada si ese `bracket_type` ya tiene cuadro generado, o si
 * `select` deja menos de 2 equipos en total (ej. copa plata cuando ningún
 * grupo tiene sobrantes) — en vez de tirar el error de
 * `generateBracketRounds`, simplemente no genera esa copa. */
async function generateGroupBracket(
  supabase: SupabaseClient,
  competitionId: string,
  bracketType: BracketType | null,
  select: StandingsSelector
): Promise<void> {
  if (await bracketExists(supabase, competitionId, bracketType)) return;

  const qualifiersByGroup = await collectGroupSeeds(supabase, competitionId, select);
  const seedTeams = buildSeedOrder(qualifiersByGroup);
  if (seedTeams.length < 2) return;

  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, bracketType, rounds);
}

/** Arma y persiste el cuadro de `format_type = 'bracket_only'`: sin fase de
 * grupos, siembra manual por `teams.seed_order` (los sin semilla quedan al
 * final, en orden de carga). */
async function generateBracketOnlyBracket(supabase: SupabaseClient, competitionId: string): Promise<void> {
  if (await bracketExists(supabase, competitionId, null)) return;

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("competition_id", competitionId)
    .order("seed_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const teamList = (teams ?? []) as Team[];
  if (teamList.length < 2) throw new Error("Cargá al menos 2 equipos antes de generar el cuadro.");

  const seedTeams = teamList.map((t, i) => ({ teamId: t.id, teamName: t.name, seed: i + 1 }));
  const rounds = generateBracketRounds(seedTeams);
  await persistBracket(supabase, competitionId, null, rounds);
}

/**
 * Arma el/los cuadro(s) de eliminatoria de una competencia, según su
 * `format_type`:
 * - `single_elimination` / `groups_only`: un único cuadro con los
 *   clasificados de cada grupo (`qualifiers_per_group`). Para
 *   `single_elimination` se dispara solo al completarse la fase de grupos
 *   (ver lib/advance-competition-phase.ts); para `groups_only` es siempre
 *   manual, vía el botón "Generar fase final" — este torneo no lo esperaba
 *   originalmente, así que nunca se dispara solo.
 * - `gold_silver`: dos cuadros — copa oro con los clasificados, copa plata
 *   con el resto de cada grupo (si un grupo no tiene sobrantes, la plata
 *   simplemente no se genera). Los partidos programables de ambos se
 *   agendan en una sola pasada de cancha/turno para no chocarse entre sí.
 * - `bracket_only`: un cuadro directo por siembra manual, sin fase de
 *   grupos.
 *
 * Es idempotente por `bracket_type`: si se vuelve a invocar, solo genera lo
 * que todavía no existe (ej. oro ya armado, plata pendiente).
 */
export async function generateBracketForCompetition(supabase: SupabaseClient, competitionId: string): Promise<void> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) throw new Error("Competencia no encontrada.");

  if (competition.format_type === "bracket_only") {
    await generateBracketOnlyBracket(supabase, competitionId);
  } else if (competition.format_type === "gold_silver") {
    await generateGroupBracket(supabase, competitionId, "gold", (s) =>
      s.slice(0, competition.qualifiers_per_group)
    );
    await generateGroupBracket(supabase, competitionId, "silver", (s) =>
      s.slice(competition.qualifiers_per_group)
    );
  } else if (competition.format_type === "single_elimination" || competition.format_type === "groups_only") {
    await generateGroupBracket(supabase, competitionId, null, (s) =>
      s.slice(0, competition.qualifiers_per_group)
    );
  } else {
    throw new Error("Esta competencia no tiene un formato con cuadro de eliminación.");
  }

  // Asignación automática de cancha + turno para los partidos que sí se van
  // a jugar (los "bye" de la ronda 1 ya quedaron completed, sin partido real
  // que jugar). Una sola pasada sobre TODOS los partidos de cuadro
  // pendientes de la competencia — así oro y plata (o un reintento parcial)
  // no se pisan el turno entre sí. Ordenados por ronda: primero las rondas
  // tempranas, después el 3er puesto, y la FINAL al final (se juega última).
  const { data: bracketMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, round")
    .eq("competition_id", competitionId)
    .eq("phase", "bracket")
    .neq("status", "completed");

  const roundOrder = (round: string | null) =>
    ({ R32: 0, R16: 1, QF: 2, SF: 3, "3P": 4, F: 5 })[round ?? ""] ?? 3;
  const toSchedule = [...(bracketMatches ?? [])].sort(
    (a, b) => roundOrder(a.round) - roundOrder(b.round)
  );

  if (toSchedule.length > 0) {
    await autoScheduleAndPersist(
      supabase,
      competition.event_id,
      competition.discipline_id,
      toSchedule as SchedulableMatch[]
    );
  }

  const { count: totalBracketMatches } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("phase", "bracket");
  if ((totalBracketMatches ?? 0) > 0) {
    // Se cierra la inscripción sola acá también — relevante sobre todo
    // para 'bracket_only', que llega a esto directo desde 'setup' sin
    // pasar por startTournament (que ya la cierra para los formatos con
    // grupos). Ver app/inscripcion/[eventId]/page.tsx.
    await supabase
      .from("competitions")
      .update({ status: "bracket_in_progress", registration_open: false })
      .eq("id", competitionId);
  }
}

/**
 * Agrega el partido por el 3er puesto (round = '3P') a un cuadro que YA
 * existe pero no lo tiene — cuadros generados antes de la migración 0014.
 * El 3er puesto es obligatorio en todos los cuadros con semifinales, así
 * que esto se llama solo desde `maybeAdvanceCompetitionPhase` y desde la
 * pantalla del torneo (ver ensureThirdPlaceMatchAction). Es idempotente: si
 * ya hay un '3P' para ese bracket_type, no hace nada.
 *
 * Requiere que el cuadro tenga semifinales (ronda 'SF' con 2 partidos) y
 * final. Engancha las dos semis con consolation_match_id/slot; si alguna ya
 * está jugada, empuja de una a su perdedor al 3er puesto. Devuelve true si
 * creó al menos un partido.
 *
 * Nunca cambia el `status` de la competencia — eso lo decide quien la llama.
 */
export async function ensureThirdPlaceMatch(
  supabase: SupabaseClient,
  competitionId: string
): Promise<boolean> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single<Competition>();
  if (!competition) return false;

  const bracketTypes: (BracketType | null)[] =
    competition.format_type === "gold_silver" ? ["gold", "silver"] : [null];

  let created = false;

  for (const bt of bracketTypes) {
    const roundRows = async (round: string) => {
      let q = supabase
        .from("matches")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("phase", "bracket")
        .eq("round", round)
        .order("bracket_slot");
      q = bt ? q.eq("bracket_type", bt) : q.is("bracket_type", null);
      const { data } = await q;
      return (data ?? []) as Match[];
    };

    if ((await roundRows("3P")).length > 0) continue;

    const semis = await roundRows("SF");
    const finals = await roundRows("F");
    if (semis.length !== 2 || finals.length === 0) continue;

    const { data: tpInserted, error } = await supabase
      .from("matches")
      .insert({
        competition_id: competitionId,
        phase: "bracket" as const,
        bracket_type: bt,
        round: "3P",
        bracket_slot: 0,
        team_a_id: null,
        team_b_id: null,
        status: "pending_teams" as const,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null,
      })
      .select("id, created_at")
      .single();
    if (error) throw error;
    created = true;

    // Guard anti-carrera (dos pestañas del admin abriendo el torneo a la
    // vez): si quedó más de un '3P' para este cuadro, se queda el más viejo
    // y se borran los demás.
    const all3p = await roundRows("3P");
    let tp = tpInserted;
    if (all3p.length > 1) {
      const sorted = [...all3p].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const keeper = sorted[0];
      const extraIds = sorted.slice(1).map((m) => m.id);
      await supabase.from("matches").delete().in("id", extraIds);
      tp = { id: keeper.id, created_at: keeper.created_at };
    }

    for (let i = 0; i < semis.length; i++) {
      const slot: "a" | "b" = i === 0 ? "a" : "b";
      const s = semis[i];
      await supabase
        .from("matches")
        .update({ consolation_match_id: tp.id, consolation_slot: slot })
        .eq("id", s.id);

      if (s.status === "completed" && s.winner_id && s.team_a_id && s.team_b_id) {
        const loserId = s.winner_id === s.team_a_id ? s.team_b_id : s.team_a_id;
        await supabase
          .from("matches")
          .update({ [slot === "a" ? "team_a_id" : "team_b_id"]: loserId })
          .eq("id", tp.id);
      }
    }

    const { data: tpNow } = await supabase
      .from("matches")
      .select("id, team_a_id, team_b_id")
      .eq("id", tp.id)
      .single<Pick<Match, "id" | "team_a_id" | "team_b_id">>();
    if (tpNow?.team_a_id && tpNow?.team_b_id) {
      await supabase.from("matches").update({ status: "scheduled" }).eq("id", tp.id);
    }

    // El 3er puesto va PRIMERO: si la final ya estaba habilitada
    // ('scheduled') pero todavía no se jugó, vuelve a 'pending_teams' hasta
    // que se juegue el 3er puesto. Si la final ya está 'completed' (cuadro
    // viejo terminado) se deja como está — no se puede des-jugar.
    if (finals[0].status === "scheduled") {
      await supabase.from("matches").update({ status: "pending_teams" }).eq("id", finals[0].id);
    }

    await autoScheduleAndPersist(supabase, competition.event_id, competition.discipline_id, [
      { id: tp.id, team_a_id: tpNow?.team_a_id ?? null, team_b_id: tpNow?.team_b_id ?? null },
    ] as SchedulableMatch[]);
  }

  return created;
}
