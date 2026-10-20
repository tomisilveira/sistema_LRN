-- ==========================================================================
-- Contrarreloj (seguidor de línea): un robot solo por vez recorre el
-- circuito y se le toma el tiempo. No hay partidos de a dos: cada robot
-- corre hasta N intentos (competitions.periods_count) con un tiempo máximo
-- por intento (competitions.period_seconds) y el ranking sale del mejor
-- tiempo (desempata el segundo mejor, ver lib/time-trial.ts).
--
--   · competitions.format_type = 'time_trial' y timer_mode = 'time_trial'
--     (se reusan period_seconds = tiempo máximo y periods_count = intentos).
--   · disciplines.timer_mode_default = 'time_trial' → al crear un torneo de
--     esa disciplina, el formato queda en contrarreloj solo.
--   · time_trial_runs: un intento por fila (tiempo o "no terminó").
--   · Disciplina nueva: "Seguidor de Línea" (slug seguidor_linea).
--
-- Aplicar en el SQL Editor de Supabase ANTES de desplegar el código.
-- Idempotente.
-- ==========================================================================

-- ---- formato y reloj ---------------------------------------------------------

-- Los check de timer_mode se crearon inline en 0006 (sin nombre explícito):
-- se borra cualquier check viejo sobre esas columnas, se llame como se
-- llame, antes de crear los nuevos con nombre fijo.
do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('competitions'::regclass, 'disciplines'::regclass)
      and (pg_get_constraintdef(oid) like '%timer_mode %' or pg_get_constraintdef(oid) like '%timer_mode_default %'
           or pg_get_constraintdef(oid) like '%(timer_mode)%' or pg_get_constraintdef(oid) like '%(timer_mode_default)%')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table competitions drop constraint if exists competitions_format_type_check;
alter table competitions add constraint competitions_format_type_check
  check (format_type in ('groups_only', 'single_elimination', 'gold_silver', 'bracket_only', 'time_trial'));

alter table competitions drop constraint if exists competitions_timer_mode_check;
alter table competitions add constraint competitions_timer_mode_check
  check (timer_mode in ('periods', 'rounds', 'time_trial'));

alter table disciplines drop constraint if exists disciplines_timer_mode_default_check;
alter table disciplines add constraint disciplines_timer_mode_default_check
  check (timer_mode_default in ('periods', 'rounds', 'time_trial'));

-- ---- intentos ------------------------------------------------------------------

create table if not exists time_trial_runs (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  attempt int not null check (attempt >= 1),
  -- Tiempo del recorrido en milisegundos. NULL cuando no terminó.
  time_ms int check (time_ms is null or time_ms > 0),
  -- false = "no terminó" (se salió de la pista, se quedó quieto, pasó el
  -- tiempo máximo...). El intento cuenta como usado pero sin tiempo.
  finished boolean not null default true,
  court_id uuid references courts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, attempt),
  check (finished = (time_ms is not null))
);

create index if not exists idx_time_trial_runs_competition on time_trial_runs (competition_id);

alter table time_trial_runs enable row level security;

drop policy if exists "public read time_trial_runs" on time_trial_runs;
create policy "public read time_trial_runs" on time_trial_runs
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

drop policy if exists "admin all time_trial_runs" on time_trial_runs;
create policy "admin all time_trial_runs" on time_trial_runs
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));

grant select on time_trial_runs to anon, authenticated;
grant insert, update, delete on time_trial_runs to authenticated;
grant select, insert, update, delete on time_trial_runs to service_role;

-- Realtime: la vista pública, la pantalla y el panel se actualizan solos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_trial_runs'
  ) then
    alter publication supabase_realtime add table time_trial_runs;
  end if;
end $$;

-- ---- disciplina ------------------------------------------------------------------
-- Reglamento: circuito cerrado siguiendo una línea, en el menor tiempo
-- posible. 3 intentos de hasta 3 minutos, vale el mejor.

insert into disciplines
  (slug, name, allow_draws_default, sort_order,
   timer_mode_default, period_seconds_default, periods_count_default, rounds_to_win_default)
values
  ('seguidor_linea', 'Seguidor de Línea', false, 6, 'time_trial', 180, 3, null)
on conflict (slug) do nothing;
