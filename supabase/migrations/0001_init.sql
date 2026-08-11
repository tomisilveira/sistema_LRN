-- Sistema de Jornada — Liga Robótica Neuquina
-- Migración inicial: schema, seeds, RLS y función de posiciones.
-- Aplicar con `supabase db push` (CLI) o pegando este archivo en el SQL Editor del proyecto Supabase.

create extension if not exists pgcrypto;

-- ==========================================================================
-- TABLAS
-- ==========================================================================

create table disciplines (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  allow_draws_default boolean not null default true,
  sort_order int not null default 0
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  min_age int,
  max_age int,
  sort_order int not null default 0
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  created_at timestamptz not null default now()
);

-- Usuarios habilitados como administrador/mesa de jueces (vinculado a Supabase Auth)
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table competitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  discipline_id uuid not null references disciplines (id),
  category_id uuid not null references categories (id),
  -- 'gold_silver' está modelado a nivel de dato pero su UI/lógica de generación
  -- de cuadro doble queda fuera de esta entrega (ver plan).
  format_type text not null default 'groups_only'
    check (format_type in ('groups_only', 'single_elimination', 'gold_silver')),
  allow_draws boolean not null default true,
  points_win int not null default 3,
  points_draw int not null default 1,
  points_loss int not null default 0,
  qualifiers_per_group int not null default 2,
  status text not null default 'setup'
    check (status in ('setup', 'groups_in_progress', 'groups_done', 'bracket_in_progress', 'finished')),
  created_at timestamptz not null default now(),
  unique (event_id, discipline_id, category_id)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  name text not null,
  institution text,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table group_teams (
  group_id uuid not null references groups (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  -- Posición final asignada a mano por el admin, para resolver empates entre
  -- 3+ equipos que la función de posiciones no puede desempatar sola
  -- (empate en puntos + diferencia + goles a favor). Si es null, se ordena
  -- automáticamente.
  manual_rank_override int,
  primary key (group_id, team_id)
);

-- Canchas del evento. access_token es el link único que usa el juez, por
-- eso la tabla completa NUNCA se expone a anon/público (ver RLS + courts_public).
create table courts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  access_token uuid not null default gen_random_uuid() unique,
  sort_order int not null default 0
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  phase text not null check (phase in ('group', 'bracket')),
  group_id uuid references groups (id) on delete cascade,
  -- null en single_elimination; 'gold'/'silver' reservado para cuando se
  -- implemente el formato oro/plata
  bracket_type text check (bracket_type in ('gold', 'silver')),
  round text, -- 'R16' | 'QF' | 'SF' | 'F' ... null en fase de grupos
  bracket_slot int, -- posición dentro de la ronda, para armar el árbol
  next_match_id uuid references matches (id),
  next_match_slot text check (next_match_slot in ('a', 'b')),
  team_a_id uuid references teams (id),
  team_b_id uuid references teams (id),
  court_id uuid references courts (id),
  turno int, -- orden dentro del cronograma del evento (detección de choques)
  status text not null default 'pending_teams'
    check (status in ('pending_teams', 'scheduled', 'in_progress', 'completed')),
  score_a int,
  score_b int,
  winner_id uuid references teams (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_matches_competition on matches (competition_id);
create index idx_matches_court_turno on matches (court_id, turno);
create index idx_matches_group on matches (group_id);
create index idx_teams_competition on teams (competition_id);
create index idx_groups_competition on groups (competition_id);
create index idx_courts_event on courts (event_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_matches_updated_at
  before update on matches
  for each row execute function set_updated_at();

-- ==========================================================================
-- SEEDS: disciplinas y categorías fijas de la Liga
-- ==========================================================================

insert into disciplines (slug, name, allow_draws_default, sort_order) values
  ('futbol', 'Fútbol Robótico', true, 1),
  ('sumo_autonomo', 'Sumo Autónomo', false, 2),
  ('sumo_rc', 'Sumo RC', false, 3),
  ('minisumo_autonomo', 'Mini Sumo Autónomo', false, 4),
  ('minisumo_rc', 'Mini Sumo RC', false, 5);

insert into categories (slug, name, min_age, max_age, sort_order) values
  ('infantil', 'Infantil', 7, 12, 1),
  ('juvenil_adultos', 'Juvenil/Adultos', 13, null, 2);

-- ==========================================================================
-- FUNCIÓN: tabla de posiciones de un grupo
-- ==========================================================================

create or replace function get_group_standings(p_group_id uuid)
returns table (
  team_id uuid,
  team_name text,
  played int,
  won int,
  drawn int,
  lost int,
  points int,
  score_for int,
  score_against int,
  score_diff int,
  manual_rank_override int
) as $$
declare
  v_competition_id uuid;
  v_win int;
  v_draw int;
  v_loss int;
begin
  select g.competition_id into v_competition_id from groups g where g.id = p_group_id;
  select c.points_win, c.points_draw, c.points_loss into v_win, v_draw, v_loss
    from competitions c where c.id = v_competition_id;

  return query
  with team_matches as (
    select
      gt.team_id as tm_team_id,
      m.id as match_id,
      case when m.team_a_id = gt.team_id then m.score_a else m.score_b end as gf,
      case when m.team_a_id = gt.team_id then m.score_b else m.score_a end as ga,
      case when m.winner_id = gt.team_id then 1 else 0 end as is_win,
      case when m.winner_id is null then 1 else 0 end as is_draw,
      case when m.winner_id is not null and m.winner_id <> gt.team_id then 1 else 0 end as is_loss
    from group_teams gt
    left join matches m
      on m.group_id = p_group_id
     and m.status = 'completed'
     and (m.team_a_id = gt.team_id or m.team_b_id = gt.team_id)
    where gt.group_id = p_group_id
  )
  select
    t.id,
    t.name,
    count(tm.match_id)::int as played,
    coalesce(sum(tm.is_win), 0)::int as won,
    coalesce(sum(tm.is_draw) filter (where tm.match_id is not null), 0)::int as drawn,
    coalesce(sum(tm.is_loss), 0)::int as lost,
    (coalesce(sum(tm.is_win), 0) * v_win
      + coalesce(sum(tm.is_draw) filter (where tm.match_id is not null), 0) * v_draw
      + coalesce(sum(tm.is_loss), 0) * v_loss)::int as points,
    coalesce(sum(tm.gf), 0)::int as score_for,
    coalesce(sum(tm.ga), 0)::int as score_against,
    (coalesce(sum(tm.gf), 0) - coalesce(sum(tm.ga), 0))::int as score_diff,
    gt2.manual_rank_override
  from teams t
  join group_teams gt2 on gt2.team_id = t.id and gt2.group_id = p_group_id
  left join team_matches tm on tm.tm_team_id = t.id
  group by t.id, t.name, gt2.manual_rank_override
  order by
    case when gt2.manual_rank_override is not null then 0 else 1 end,
    gt2.manual_rank_override asc nulls last,
    points desc,
    score_diff desc,
    score_for desc,
    t.name asc;
end;
$$ language plpgsql stable;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

alter table disciplines enable row level security;
alter table categories enable row level security;
alter table events enable row level security;
alter table competitions enable row level security;
alter table teams enable row level security;
alter table groups enable row level security;
alter table group_teams enable row level security;
alter table courts enable row level security;
alter table matches enable row level security;
alter table admins enable row level security;

-- security definer: evita recursión de RLS al chequear membresía de admins
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql stable security definer set search_path = public;

-- Lectura pública (anon + authenticated) de todo lo que la pantalla de
-- público necesita mostrar. `courts` NO se incluye acá (ver courts_public).
create policy "public read disciplines" on disciplines for select using (true);
create policy "public read categories" on categories for select using (true);
create policy "public read events" on events for select using (true);
create policy "public read competitions" on competitions for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read groups" on groups for select using (true);
create policy "public read group_teams" on group_teams for select using (true);
create policy "public read matches" on matches for select using (true);

-- Escritura/administración total solo para usuarios en `admins`
create policy "admin all disciplines" on disciplines for all using (is_admin()) with check (is_admin());
create policy "admin all categories" on categories for all using (is_admin()) with check (is_admin());
create policy "admin all events" on events for all using (is_admin()) with check (is_admin());
create policy "admin all competitions" on competitions for all using (is_admin()) with check (is_admin());
create policy "admin all teams" on teams for all using (is_admin()) with check (is_admin());
create policy "admin all groups" on groups for all using (is_admin()) with check (is_admin());
create policy "admin all group_teams" on group_teams for all using (is_admin()) with check (is_admin());
create policy "admin all courts" on courts for all using (is_admin()) with check (is_admin());
create policy "admin all matches" on matches for all using (is_admin()) with check (is_admin());
create policy "admin read admins" on admins for select using (is_admin());

-- Vista pública de canchas: expone nombre pero NO access_token.
-- Las vistas corren con los permisos del dueño (no heredan RLS de `courts`
-- para el usuario que consulta), así que alcanza con no otorgar select
-- sobre `courts` a anon/authenticated y sí sobre esta vista.
create view courts_public as
  select id, event_id, name, sort_order from courts;

grant execute on function is_admin() to anon, authenticated;
grant execute on function get_group_standings(uuid) to anon, authenticated;

grant select on courts_public to anon, authenticated;
grant select on disciplines, categories, events, competitions, teams, groups, group_teams, matches
  to anon, authenticated;

-- Privilegios de escritura a nivel tabla para `authenticated`; RLS (is_admin())
-- es la que efectivamente restringe la escritura a usuarios en `admins`.
grant insert, update, delete on
  disciplines, categories, events, competitions, teams, groups, group_teams, courts, matches
  to authenticated;
grant select on admins to authenticated;

-- ==========================================================================
-- REALTIME: la vista pública y el panel admin se subscriben a cambios en
-- `matches` (resultados cargados por los jueces) para actualizarse solos.
-- ==========================================================================

alter publication supabase_realtime add table matches;
