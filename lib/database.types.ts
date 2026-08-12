// Tipos manuales que reflejan supabase/migrations/0001_init.sql y 0002_features.sql.
// Si el schema cambia, actualizar este archivo a mano (no se generó con
// `supabase gen types` porque el proyecto Supabase todavía no existe).

export type FormatType = "groups_only" | "single_elimination" | "gold_silver";
export type CompetitionStatus =
  | "setup"
  | "groups_in_progress"
  | "groups_done"
  | "bracket_in_progress"
  | "finished";
export type MatchPhase = "group" | "bracket";
export type BracketType = "gold" | "silver";
export type MatchStatus = "pending_teams" | "scheduled" | "in_progress" | "completed";
export type EventStatus = "draft" | "active" | "finished";

export interface Discipline {
  id: string;
  slug: string;
  name: string;
  allow_draws_default: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  min_age: number | null;
  max_age: number | null;
  sort_order: number;
}

export interface EventRow {
  id: string;
  name: string;
  event_date: string;
  status: EventStatus;
  created_at: string;
}

export interface Competition {
  id: string;
  event_id: string;
  discipline_id: string;
  category_id: string;
  format_type: FormatType;
  allow_draws: boolean;
  points_win: number;
  points_draw: number;
  points_loss: number;
  qualifiers_per_group: number;
  status: CompetitionStatus;
  registration_open: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  competition_id: string;
  name: string;
  institution: string | null;
  mentor_name: string | null;
  mentor_contact: string | null;
  member_count: number | null;
  notes: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  competition_id: string;
  name: string;
  sort_order: number;
}

export interface GroupTeam {
  group_id: string;
  team_id: string;
  manual_rank_override: number | null;
}

export interface Court {
  id: string;
  event_id: string;
  name: string;
  access_token: string;
  sort_order: number;
}

export interface CourtPublic {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
}

export interface Match {
  id: string;
  competition_id: string;
  phase: MatchPhase;
  group_id: string | null;
  bracket_type: BracketType | null;
  round: string | null;
  bracket_slot: number | null;
  next_match_id: string | null;
  next_match_slot: "a" | "b" | null;
  team_a_id: string | null;
  team_b_id: string | null;
  court_id: string | null;
  turno: number | null;
  status: MatchStatus;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupStandingRow {
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  score_for: number;
  score_against: number;
  score_diff: number;
  manual_rank_override: number | null;
}

export interface AdminRow {
  user_id: string;
  full_name: string | null;
  created_at: string;
}
