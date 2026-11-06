import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeEventStats, teamParticipants, type StatsMatch, type StatsTeam } from "@/lib/event-stats";
import { computeLocationBreakdown, type LocationTeam } from "@/lib/location-stats";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineDisplayName } from "@/lib/discipline-display";
import type { Competition } from "@/lib/database.types";

// Números de toda una temporada para la vidriera de la portada
// (app/components/season-showcase.tsx): se juntan los encuentros TERMINADOS
// del año — los de prueba quedan afuera porque nunca se cierran — sean
// públicos o no (los regionales suelen quedar privados, pero contar cuántos
// equipos fueron no expone nada). Solo salen conteos agregados, ningún dato
// de equipo. Por eso usa la service-role, igual que el locutor.

export interface SeasonEventPoint {
  id: string;
  /** Nombre corto para el eje ("Alto del Neuquén", "Final Ruca Che"...). */
  label: string;
  date: string;
  teams: number;
  participants: number;
  played: number;
}

export interface SeasonDisciplineSlice {
  name: string;
  hex: string;
  teams: number;
  participants: number;
}

export interface SeasonStats {
  year: number;
  events: number;
  teams: number;
  participants: number;
  robots: number;
  institutions: number;
  localities: number;
  played: number;
  goals: number;
  runs: number;
  perEvent: SeasonEventPoint[];
  byDiscipline: SeasonDisciplineSlice[];
  topLocalities: { label: string; participants: number }[];
}

type SeasonCompetition = Pick<Competition, "id" | "event_id" | "discipline_id" | "timer_mode"> & {
  disciplines: { name: string; sort_order: number } | null;
};

const TEAM_COLUMNS =
  "id, name, competition_id, institution, province, locality, member_count, member_names, robot_names, participants_present, accredited, withdrawn_at";
const MATCH_COLUMNS = "competition_id, status, team_a_id, team_b_id, score_a, score_b, forfeit";
const PAGE = 1000;

/** PostgREST corta en 1000 filas: una temporada entera puede pasarse. */
async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function shortEventLabel(name: string): string {
  return (
    name
      .replace(/^(Encuentro\s+)?Regional\s+/i, "")
      .replace(/^Final\s+Liga\s+Rob[oó]tica\s+Neuquina\s*[-–—]\s*/i, "Final · ")
      .replace(/\s+[-–—]\s+/g, " · ")
      .trim() || name
  );
}

async function loadSeasonStats(year: number): Promise<SeasonStats | null> {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, event_date")
    .eq("status", "finished")
    .gte("event_date", `${year}-01-01`)
    .lte("event_date", `${year}-12-31`)
    .order("event_date");
  if (error) throw new Error(error.message);
  if (!events || events.length === 0) return null;
  const eventIds = events.map((e) => e.id as string);

  const { data: comps, error: compError } = await admin
    .from("competitions")
    .select("id, event_id, discipline_id, timer_mode, disciplines(name, sort_order)")
    .in("event_id", eventIds);
  if (compError) throw new Error(compError.message);
  const competitions = (comps ?? []) as unknown as SeasonCompetition[];
  const competitionIds = competitions.map((c) => c.id);
  if (competitionIds.length === 0) return null;

  const [teams, matches, runs] = await Promise.all([
    fetchAll<StatsTeam & LocationTeam>((from, to) =>
      admin.from("teams").select(TEAM_COLUMNS).in("competition_id", competitionIds).order("id").range(from, to)
    ),
    fetchAll<StatsMatch>((from, to) =>
      admin.from("matches").select(MATCH_COLUMNS).in("competition_id", competitionIds).order("id").range(from, to)
    ),
    fetchAll<{ competition_id: string }>((from, to) =>
      admin.from("time_trial_runs").select("competition_id").in("competition_id", competitionIds).order("id").range(from, to)
    ),
  ]);

  // Totales de la temporada: instituciones y localidades sin repetir entre
  // encuentros; equipos/participantes suman cada participación.
  const season = computeEventStats({ competitions, teams, matches, runs });

  const compsByEvent = new Map<string, Set<string>>();
  for (const c of competitions) {
    const set = compsByEvent.get(c.event_id) ?? new Set<string>();
    set.add(c.id);
    compsByEvent.set(c.event_id, set);
  }
  const perEvent: SeasonEventPoint[] = events.map((e) => {
    const ids = compsByEvent.get(e.id as string) ?? new Set<string>();
    const s = computeEventStats({
      competitions: competitions.filter((c) => ids.has(c.id)),
      teams: teams.filter((t) => ids.has(t.competition_id)),
      matches: matches.filter((m) => ids.has(m.competition_id)),
      runs: runs.filter((r) => ids.has(r.competition_id)),
    });
    return {
      id: e.id as string,
      label: shortEventLabel(e.name as string),
      date: e.event_date as string,
      teams: s.teams,
      participants: s.participants,
      played: s.played,
    };
  });

  const disciplineById = new Map(competitions.map((c) => [c.discipline_id, c.disciplines]));
  const byDiscipline = season.byDiscipline
    .map((d) => {
      const disc = disciplineById.get(d.disciplineId) ?? null;
      return {
        name: disc ? disciplineDisplayName(disc.name) : "?",
        hex: disciplineColor(disc).hex,
        sort: disc?.sort_order ?? 99,
        teams: d.teams,
        participants: d.participants,
      };
    })
    .sort((a, b) => a.sort - b.sort)
    .map((d) => ({ name: d.name, hex: d.hex, teams: d.teams, participants: d.participants }));

  const topLocalities = computeLocationBreakdown(teams)
    .rows.slice(0, 6)
    .map((r) => ({ label: r.locality, participants: r.participants }));

  return {
    year,
    events: events.length,
    teams: season.teams,
    participants: teams.reduce((n, t) => n + teamParticipants(t), 0),
    robots: season.robots,
    institutions: season.institutions,
    localities: season.localities,
    played: season.played,
    goals: season.goals,
    runs: season.runs,
    perEvent,
    byDiscipline,
    topLocalities,
  };
}

/** Cacheado 10 min: la portada se rearma cada 5 s (ISR) y estos números
 * solo cambian cuando se cierra un encuentro. */
export const getSeasonStats = unstable_cache(loadSeasonStats, ["season-stats-v1"], { revalidate: 600 });
