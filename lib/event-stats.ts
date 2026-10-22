// Números generales del evento para la pantalla del locutor (ver
// app/evento/[eventId]/locutor). Lógica pura, sin DB.
import type { Competition, Match, Team, TimeTrialRun } from "./database.types";
import { parseMemberNames, parseRobotNames } from "./team-display";

export type StatsTeam = Pick<
  Team,
  | "id"
  | "competition_id"
  | "institution"
  | "province"
  | "locality"
  | "member_count"
  | "member_names"
  | "robot_names"
  | "participants_present"
  | "accredited"
  | "withdrawn_at"
>;

export type StatsMatch = Pick<
  Match,
  "competition_id" | "status" | "team_a_id" | "team_b_id" | "score_a" | "score_b" | "forfeit"
>;

export type StatsCompetition = Pick<Competition, "id" | "discipline_id" | "timer_mode">;

export interface DisciplineStats {
  disciplineId: string;
  teams: number;
  robots: number;
  participants: number;
  played: number;
  total: number;
  runs: number;
}

export interface EventStats {
  teams: number;
  withdrawn: number;
  accredited: number;
  robots: number;
  participants: number;
  institutions: number;
  localities: number;
  provinces: number;
  played: number;
  live: number;
  /** Partidos que faltan (programados + esperando rivales del cuadro). */
  remaining: number;
  total: number;
  forfeits: number;
  /** Solo torneos por tiempo (fútbol): en sumo el marcador son rounds. */
  goals: number;
  /** Intentos de contrarreloj cargados (seguidor de línea). */
  runs: number;
  byDiscipline: DisciplineStats[];
}

/** Personas del equipo: las presentes al acreditar si hay dato, si no las
 * declaradas en la inscripción (cantidad o lista de nombres). */
export function teamParticipants(t: StatsTeam): number {
  return t.participants_present ?? t.member_count ?? parseMemberNames(t.member_names).length;
}

/** Robots del equipo: fútbol carga los nombres (2-3); el resto es 1 robot. */
export function teamRobots(t: StatsTeam): number {
  return Math.max(1, parseRobotNames(t.robot_names).length);
}

/** Byes del cuadro (pase directo): se cierran solos con un único equipo. */
function isBye(m: StatsMatch): boolean {
  return m.status === "completed" && (!m.team_a_id || !m.team_b_id);
}

function normalized(s: string | null | undefined): string | null {
  const v = s?.trim().toLowerCase();
  return v ? v : null;
}

export function computeEventStats({
  competitions,
  teams,
  matches,
  runs,
}: {
  competitions: StatsCompetition[];
  teams: StatsTeam[];
  matches: StatsMatch[];
  runs: Pick<TimeTrialRun, "competition_id">[];
}): EventStats {
  const competitionById = new Map(competitions.map((c) => [c.id, c]));
  const byDiscipline = new Map<string, DisciplineStats>();
  const disciplineOf = (competitionId: string): DisciplineStats | null => {
    const c = competitionById.get(competitionId);
    if (!c) return null;
    let d = byDiscipline.get(c.discipline_id);
    if (!d) {
      d = { disciplineId: c.discipline_id, teams: 0, robots: 0, participants: 0, played: 0, total: 0, runs: 0 };
      byDiscipline.set(c.discipline_id, d);
    }
    return d;
  };

  const stats: EventStats = {
    teams: 0,
    withdrawn: 0,
    accredited: 0,
    robots: 0,
    participants: 0,
    institutions: 0,
    localities: 0,
    provinces: 0,
    played: 0,
    live: 0,
    remaining: 0,
    total: 0,
    forfeits: 0,
    goals: 0,
    runs: 0,
    byDiscipline: [],
  };

  const institutions = new Set<string>();
  const localities = new Set<string>();
  const provinces = new Set<string>();
  for (const t of teams) {
    const d = disciplineOf(t.competition_id);
    if (!d) continue;
    const participants = teamParticipants(t);
    const robots = teamRobots(t);
    stats.teams++;
    stats.participants += participants;
    stats.robots += robots;
    d.teams++;
    d.participants += participants;
    d.robots += robots;
    if (t.withdrawn_at) stats.withdrawn++;
    if (t.accredited) stats.accredited++;
    const inst = normalized(t.institution);
    if (inst) institutions.add(inst);
    const prov = normalized(t.province);
    if (prov) provinces.add(prov);
    const loc = normalized(t.locality);
    if (loc) localities.add(`${prov ?? ""}|${loc}`);
  }
  stats.institutions = institutions.size;
  stats.localities = localities.size;
  stats.provinces = provinces.size;

  for (const m of matches) {
    if (isBye(m)) continue;
    const d = disciplineOf(m.competition_id);
    if (!d) continue;
    stats.total++;
    d.total++;
    if (m.status === "completed") {
      if (m.forfeit) {
        stats.forfeits++;
      } else {
        stats.played++;
        d.played++;
      }
    } else if (m.status === "in_progress") {
      stats.live++;
    } else {
      stats.remaining++;
    }
    const timed = competitionById.get(m.competition_id)?.timer_mode === "periods";
    if (timed && !m.forfeit && (m.status === "completed" || m.status === "in_progress")) {
      stats.goals += (m.score_a ?? 0) + (m.score_b ?? 0);
    }
  }

  for (const r of runs) {
    const d = disciplineOf(r.competition_id);
    if (!d) continue;
    stats.runs++;
    d.runs++;
  }

  stats.byDiscipline = [...byDiscipline.values()];
  return stats;
}
