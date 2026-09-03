// Tipos manuales que reflejan el schema (supabase/schema.sql, o el estado
// final de supabase/migrations/). Se mantienen a mano en vez de con
// `supabase gen types` porque el schema se aplica pegando el .sql en el SQL
// Editor y no hay un proyecto Supabase de referencia commiteado. Si tocás el
// schema, actualizá también este archivo.

export type FormatType = "groups_only" | "single_elimination" | "gold_silver" | "bracket_only";
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
export type TimerMode = "periods" | "rounds";

export interface Discipline {
  id: string;
  slug: string;
  name: string;
  allow_draws_default: boolean;
  sort_order: number;
  // Config de timer por defecto, copiada a la competencia al crear el
  // torneo (ver 0006_match_timer.sql) — 'rounds' para sumo/mini sumo
  // (mejor de 3), 'periods' para fútbol (tiempos configurables).
  timer_mode_default: TimerMode;
  period_seconds_default: number | null;
  periods_count_default: number;
  rounds_to_win_default: number | null;
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
  // Visibilidad en la sección pública (independiente de `status`) — un
  // evento en borrador o ya armado puede quedar oculto de /publico y del
  // inicio hasta que el admin lo publique.
  is_public: boolean;
  created_at: string;
  // Solo viene en la respuesta cuando se consulta con sesión de admin o con
  // la service-role key — `anon` no tiene grant de esta columna (ver
  // 0003_accreditation.sql), así que en las páginas públicas viene undefined.
  accreditation_token?: string;
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
  // Columna de 0014_third_place_match.sql. Quedó sin uso: el partido por el
  // 3er puesto pasó a ser obligatorio en todo cuadro con semifinales (ya no
  // es un toggle). Se deja la columna (default true) por si vuelve a hacer
  // falta configurarlo por torneo.
  third_place_match: boolean;
  created_at: string;
  // Config de timer de este torneo puntual (copiada del discipline al
  // crearlo, editable en "Formato del torneo" mientras status='setup').
  timer_mode: TimerMode;
  period_seconds: number | null;
  periods_count: number;
  rounds_to_win: number | null;
}

export interface Team {
  id: string;
  competition_id: string;
  name: string;
  institution: string | null;
  mentor_name: string | null;
  mentor_contact: string | null;
  member_count: number | null;
  // Nombres de las personas inscriptas con este equipo/robot — texto libre,
  // una por línea o separadas por coma (ver 0008_team_member_names.sql).
  // Se muestran en todo el sistema como "Robot (Fulano, Mengano)".
  member_names: string | null;
  // Nombres de los robots del equipo — solo se pide en fútbol robótico
  // (2 titulares + 1 suplente opcional), mismo criterio de texto libre que
  // member_names (ver 0010_team_robots_and_terms.sql).
  robot_names: string | null;
  // Cuándo se tildó "Leí y acepto las bases y condiciones" en la
  // inscripción pública — null si el equipo se cargó a mano desde el panel
  // admin (ese formulario no pide el checkbox).
  accepted_terms_at: string | null;
  notes: string | null;
  accredited: boolean;
  accredited_at: string | null;
  homologated: boolean;
  homologated_at: string | null;
  participants_present: number | null;
  // Orden de siembra manual, solo relevante en format_type = 'bracket_only'
  // (ver 0007_bracket_formats.sql) — null = se usa el orden de created_at.
  seed_order: number | null;
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
  // Disciplina para la que está armada la cancha físicamente (fútbol, sumo,
  // mini sumo...). Null en canchas viejas todavía sin clasificar.
  discipline_id: string | null;
}

export interface CourtPublic {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  discipline_id: string | null;
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
  // Partido por el 3er puesto (round = '3P') al que se empuja el PERDEDOR de
  // esta semifinal — análogo a next_match_id/next_match_slot para el ganador
  // (ver 0014_third_place_match.sql y lib/bracket-actions.ts). NULL fuera de
  // las semifinales.
  consolation_match_id: string | null;
  consolation_slot: "a" | "b" | null;
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
  // Reloj pausable del período/ronda actual (ver 0006_match_timer.sql y
  // lib/match-timer.ts) — independiente de `started_at`, que sigue
  // significando "cuándo se abrió el partido por primera vez".
  timer_running_since: string | null;
  timer_elapsed_seconds: number;
  current_period: number;
  round_winner_ids: string[];
}

export type CardType = "yellow" | "red";

// Tarjeta amarilla/roja a un equipo dentro de un partido puntual (ver
// 0009_match_cards.sql). Doble amarilla = roja es una regla de
// visualización (lib/match-cards.ts), no se guarda una fila 'red' aparte
// cuando pasa eso — el historial real son 2 filas 'yellow'.
export interface MatchCard {
  id: string;
  match_id: string;
  team_id: string;
  card_type: CardType;
  reason: string | null;
  created_at: string;
}

export interface GroupStandingRow {
  team_id: string;
  team_name: string;
  member_names: string | null;
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
