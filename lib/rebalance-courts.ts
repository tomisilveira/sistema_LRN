import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bracketStage, rebalanceSchedule, type RebalanceMatch, type ScheduleAssignment } from "./auto-schedule";
import { persistCourtAssignments } from "./apply-auto-schedule";
import { disciplineDisplayName } from "./discipline-display";

export interface RebalanceSummaryRow {
  /** Disciplinas que comparten este juego de canchas. */
  disciplines: string[];
  courts: number;
  matches: number;
  /** Partidos por cancha después de redistribuir (mínimo y máximo). */
  minPerCourt: number;
  maxPerCourt: number;
}

export interface RebalanceSummary {
  moved: number;
  rows: RebalanceSummaryRow[];
}

type CourtRow = { id: string; discipline_id: string | null; sort_order: number };
type CompetitionRow = {
  id: string;
  discipline_id: string;
  /** Canchas elegidas para el torneo (0023); puede no venir sin la migración. */
  court_ids?: string[] | null;
  disciplines: { name: string } | null;
};
type MatchRow = {
  id: string;
  competition_id: string;
  phase: "group" | "bracket";
  round: string | null;
  bracket_type: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: string;
  court_id: string | null;
  turno: number | null;
  created_at: string;
};

const MOVABLE = new Set(["scheduled", "pending_teams"]);

/**
 * Vuelve a repartir entre las canchas TODOS los partidos sin jugar del
 * evento, disciplina por disciplina:
 * - Cada disciplina usa sus canchas (las etiquetadas con ella). Si no tiene
 *   ninguna, las sin disciplina; si tampoco hay, todas — igual que
 *   getUsableCourts. Disciplinas que terminan usando las mismas canchas se
 *   reparten juntas, así no se pisan.
 * - No toca los partidos en juego ni los jugados: los pendientes arrancan
 *   en el turno siguiente al último usado en esas canchas.
 * - Dentro de cada torneo se respeta el orden actual (grupos primero, el
 *   cuadro por rondas) y los torneos se intercalan.
 */
export async function rebalanceEventCourts(
  supabase: SupabaseClient,
  eventId: string
): Promise<RebalanceSummary> {
  const [{ data: courtsData, error: courtsError }, { data: compsData, error: compsError }] = await Promise.all([
    supabase.from("courts").select("id, discipline_id, sort_order").eq("event_id", eventId).order("sort_order"),
    // "*" y no columnas puntuales: court_ids puede no existir (0023 sin aplicar).
    supabase.from("competitions").select("*, disciplines(name)").eq("event_id", eventId),
  ]);
  if (courtsError) throw new Error(courtsError.message);
  if (compsError) throw new Error(compsError.message);

  const courts = (courtsData ?? []) as CourtRow[];
  const competitions = (compsData ?? []) as unknown as CompetitionRow[];
  if (courts.length === 0) throw new Error("El evento no tiene canchas cargadas.");
  if (competitions.length === 0) return { moved: 0, rows: [] };

  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select("id, competition_id, phase, round, bracket_type, team_a_id, team_b_id, status, court_id, turno, created_at")
    .in(
      "competition_id",
      competitions.map((c) => c.id)
    );
  if (matchesError) throw new Error(matchesError.message);
  const matches = (matchesData ?? []) as MatchRow[];

  // Canchas de cada disciplina (mismo criterio que getUsableCourts, con un
  // paso intermedio: las sin disciplina antes que las de otra).
  const untagged = courts.filter((c) => !c.discipline_id);
  const courtsFor = (disciplineId: string) => {
    const own = courts.filter((c) => c.discipline_id === disciplineId);
    if (own.length > 0) return own;
    return untagged.length > 0 ? untagged : courts;
  };

  // Canchas de cada torneo: las elegidas en el torneo (court_ids) si hay,
  // si no las de su disciplina.
  const courtsOfComp = new Map<string, CourtRow[]>();
  for (const comp of competitions) {
    const chosen = (comp.court_ids ?? []).length > 0 ? courts.filter((c) => comp.court_ids!.includes(c.id)) : [];
    courtsOfComp.set(comp.id, chosen.length > 0 ? chosen : courtsFor(comp.discipline_id));
  }

  // Agrupar torneos que comparten alguna cancha (se reparten juntos para no
  // pisarse); cada partido después solo va a las canchas de su torneo.
  type Pool = { courtIds: Set<string>; competitions: CompetitionRow[] };
  let poolList: Pool[] = [];
  for (const comp of competitions) {
    const ids = new Set(courtsOfComp.get(comp.id)!.map((c) => c.id));
    const overlapping = poolList.filter((p) => [...ids].some((id) => p.courtIds.has(id)));
    const merged: Pool = { courtIds: ids, competitions: [comp] };
    for (const p of overlapping) {
      p.courtIds.forEach((id) => merged.courtIds.add(id));
      merged.competitions.push(...p.competitions);
    }
    poolList = [...poolList.filter((p) => !overlapping.includes(p)), merged];
  }
  const pools = poolList.map((p) => ({
    courts: courts.filter((c) => p.courtIds.has(c.id)),
    competitions: p.competitions,
  }));

  const stageOf = (m: MatchRow) => (m.phase === "group" ? 0 : bracketStage(m.round));
  const updates: ScheduleAssignment[] = [];
  const rows: RebalanceSummaryRow[] = [];

  for (const pool of pools) {
    const compIds = new Set(pool.competitions.map((c) => c.id));
    const courtIds = new Set(pool.courts.map((c) => c.id));

    // Los partidos jugados o en juego de estas canchas quedan donde están;
    // lo pendiente arranca después del último turno usado.
    const fixedTurnos = matches
      .filter((m) => !MOVABLE.has(m.status) && m.turno !== null && (compIds.has(m.competition_id) || (m.court_id && courtIds.has(m.court_id))))
      .map((m) => m.turno as number);
    const startTurno = (fixedTurnos.length > 0 ? Math.max(...fixedTurnos) : 0) + 1;

    const movable: RebalanceMatch[] = matches
      .filter((m) => compIds.has(m.competition_id) && MOVABLE.has(m.status))
      // Pase directo sin rival ya resuelto no llega acá (está completed).
      .sort(
        (a, b) =>
          stageOf(a) - stageOf(b) ||
          (a.turno ?? Infinity) - (b.turno ?? Infinity) ||
          a.created_at.localeCompare(b.created_at)
      )
      .map((m) => ({
        id: m.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        competitionId: m.competition_id,
        chain: `${m.competition_id}|${m.bracket_type ?? ""}`,
        stage: stageOf(m),
        courtIds: courtsOfComp.get(m.competition_id)!.map((c) => c.id),
      }));
    if (movable.length === 0) continue;

    const assignments = rebalanceSchedule(movable, pool.courts, startTurno);
    const before = new Map(matches.map((m) => [m.id, m]));
    const perCourt = new Map(pool.courts.map((c) => [c.id, 0]));
    for (const a of assignments) {
      perCourt.set(a.courtId, (perCourt.get(a.courtId) ?? 0) + 1);
      const prev = before.get(a.matchId);
      if (prev?.court_id !== a.courtId || prev?.turno !== a.turno) {
        updates.push(a);
      }
    }
    const loads = [...perCourt.values()];
    rows.push({
      disciplines: [
        ...new Set(pool.competitions.map((c) => disciplineDisplayName(c.disciplines?.name ?? "Sin disciplina"))),
      ],
      courts: pool.courts.length,
      matches: assignments.length,
      minPerCourt: Math.min(...loads),
      maxPerCourt: Math.max(...loads),
    });
  }

  // Si el juez arrancó alguno mientras tanto, ese no se mueve.
  await persistCourtAssignments(supabase, updates, [...MOVABLE]);

  return { moved: updates.length, rows };
}
