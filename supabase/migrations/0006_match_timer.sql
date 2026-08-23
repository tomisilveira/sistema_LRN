-- Fase 6: cuenta regresiva pausable con lógica de tiempos por disciplina.
-- Migración puramente aditiva (ALTER TABLE ADD COLUMN) — no toca datos
-- existentes ni la columna `started_at` (que sigue significando "cuándo se
-- abrió el partido por primera vez").
-- Aplicar en el SQL Editor de Supabase, después de 0001..0005.

-- ==========================================================================
-- Configuración de timer por disciplina (default) y por torneo (editable).
-- 'periods': N períodos de duración fija, el marcador acumula entre
--   períodos (fútbol) — se cierra con el flujo de resultado ya existente.
-- 'rounds': hasta N rounds de duración fija, decidido apenas un equipo
--   gana `rounds_to_win` rounds (sumo/mini sumo, mejor de 3).
-- ==========================================================================

alter table disciplines add column if not exists timer_mode_default text
  not null default 'periods' check (timer_mode_default in ('periods', 'rounds'));
alter table disciplines add column if not exists period_seconds_default int;
alter table disciplines add column if not exists periods_count_default int not null default 1;
alter table disciplines add column if not exists rounds_to_win_default int;

alter table competitions add column if not exists timer_mode text
  not null default 'periods' check (timer_mode in ('periods', 'rounds'));
alter table competitions add column if not exists period_seconds int;
alter table competitions add column if not exists periods_count int not null default 1;
alter table competitions add column if not exists rounds_to_win int;

-- Defaults por disciplina existente, según los reglamentos técnicos 2026:
-- sumo/mini sumo a rounds (mejor de 3, 2 minutos cada asalto — Novedad 2026
-- bajó de 3 a 2 minutos), fútbol a períodos (2 tiempos de 3 minutos,
-- editable por torneo desde "Formato del torneo").
update disciplines set
  timer_mode_default = 'rounds',
  period_seconds_default = 120,
  periods_count_default = 3,
  rounds_to_win_default = 2
where slug in ('sumo_autonomo', 'sumo_rc', 'minisumo_autonomo', 'minisumo_rc');

update disciplines set
  timer_mode_default = 'periods',
  period_seconds_default = 180,
  periods_count_default = 2,
  rounds_to_win_default = null
where slug = 'futbol';

-- ==========================================================================
-- Estado del reloj pausable del período/ronda ACTUAL de un partido.
-- Restante = period_seconds - timer_elapsed_seconds
--            - (timer_running_since is not null ? now() - timer_running_since : 0)
-- Pausado  = status = 'in_progress' and timer_running_since is null
--            and timer_elapsed_seconds > 0
-- ==========================================================================

alter table matches add column if not exists timer_running_since timestamptz;
alter table matches add column if not exists timer_elapsed_seconds int not null default 0;
alter table matches add column if not exists current_period int not null default 1;
alter table matches add column if not exists round_winner_ids uuid[] not null default '{}';

-- Backfill: los torneos creados ANTES de esta migración quedarían con
-- period_seconds/rounds_to_win en null (sin default de columna) y se
-- caerían al cierre manual de siempre (ver match-timer-panel.tsx). Para que
-- el reloj funcione de entrada sin que un admin tenga que entrar a
-- "Formato del torneo" a recargar cada competencia existente, se heredan
-- los defaults de la disciplina — solo en las filas que todavía no tienen
-- period_seconds seteado (no pisa nada ya configurado a mano).
update competitions c set
  timer_mode = d.timer_mode_default,
  period_seconds = d.period_seconds_default,
  periods_count = d.periods_count_default,
  rounds_to_win = d.rounds_to_win_default
from disciplines d
where c.discipline_id = d.id and c.period_seconds is null;

-- `matches` ya tiene grant de tabla completa a anon/authenticated (0001_init.sql)
-- y ya está en la publicación de realtime — las columnas nuevas quedan
-- cubiertas solas, no hace falta ningún GRANT ni ALTER PUBLICATION extra.
