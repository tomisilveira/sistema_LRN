-- ==========================================================================
-- Liga Robótica Neuquina — Sistema de Jornada
-- SCHEMA COMPLETO (estado final del sistema).
--
-- Este archivo crea la base entera de una sola vez: tablas, índices,
-- funciones, RLS, grants por columna, vistas, seeds y la publicación de
-- Realtime. Es el resultado consolidado de las 15 migraciones incrementales
-- que se fueron aplicando durante el desarrollo (siguen en el historial de
-- git, carpeta supabase/migrations/ hasta el commit que las reemplazó).
--
-- CÓMO APLICARLO
--   Base nueva  → pegá y ejecutá este archivo completo en el SQL Editor del
--                 proyecto Supabase (o `supabase db push` si usás la CLI).
--   Base vieja  → ya tiene todo esto aplicado migración por migración; no
--                 corras este archivo encima.
--
-- REQUISITOS DEL DESTINO
--   Un proyecto Supabase (o Supabase self-hosted). El sistema depende de
--   Supabase Auth (schema `auth`, `auth.uid()`), PostgREST (roles `anon` /
--   `authenticated`, API REST) y Realtime (publicación `supabase_realtime`).
--   No corre sobre un Postgres "pelado" sin esas piezas.
-- ==========================================================================

create extension if not exists pgcrypto;

-- ==========================================================================
-- TABLAS
-- ==========================================================================

-- Catálogo fijo de disciplinas de la Liga (sembrado más abajo).
create table disciplines (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  allow_draws_default boolean not null default true,
  sort_order int not null default 0,
  -- Config de cronómetro por defecto: se copia a la competencia al crear el
  -- torneo. 'periods' = N tiempos de duración fija con marcador acumulado
  -- (fútbol); 'rounds' = hasta N asaltos, se define al llegar a
  -- rounds_to_win (sumo / mini sumo, mejor de 3).
  timer_mode_default text not null default 'periods'
    check (timer_mode_default in ('periods', 'rounds')),
  period_seconds_default int,
  periods_count_default int not null default 1,
  rounds_to_win_default int
);

-- Catálogo fijo de categorías (sembrado más abajo).
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
  created_at timestamptz not null default now(),
  -- Link único de la mesa de acreditación (sin login, a nivel evento porque
  -- una sola mesa atiende equipos de cualquier disciplina del día).
  accreditation_token uuid not null default gen_random_uuid() unique,
  -- Visibilidad en la sección pública, independiente de `status`: un evento
  -- en borrador o ya armado puede quedar oculto de /publico y del inicio
  -- hasta que el admin lo publique. Es una barrera de datos real (ver RLS
  -- más abajo), no solo un filtro de UI.
  is_public boolean not null default true,
  -- Quién lo creó (dato histórico; el acceso lo da event_admins, al que el
  -- trigger events_add_creator_as_admin suma al creador).
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- Usuarios habilitados en el panel admin. 'superadmin' ve y edita todo,
-- crea usuarios y maneja disciplinas/categorías; 'event_admin' solo los
-- eventos donde figura en event_admins. `email` copiado de auth.users
-- (authenticated no puede leer auth.users) para mostrar/compartir.
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'event_admin' check (role in ('superadmin', 'event_admin')),
  created_at timestamptz not null default now()
);

-- Qué administrador administra qué evento (compartir evento).
create table event_admins (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references admins (user_id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_admins_user_idx on event_admins (user_id);

create table competitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  discipline_id uuid not null references disciplines (id),
  category_id uuid not null references categories (id),
  format_type text not null default 'groups_only'
    check (format_type in ('groups_only', 'single_elimination', 'gold_silver', 'bracket_only')),
  allow_draws boolean not null default true,
  points_win int not null default 3,
  points_draw int not null default 1,
  points_loss int not null default 0,
  qualifiers_per_group int not null default 2,
  status text not null default 'setup'
    check (status in ('setup', 'groups_in_progress', 'groups_done', 'bracket_in_progress', 'finished')),
  created_at timestamptz not null default now(),
  -- El admin habilita/deshabilita la inscripción pública por torneo.
  registration_open boolean not null default false,
  -- Config de cronómetro de este torneo puntual (copiada del discipline al
  -- crearlo, editable en "Formato del torneo" mientras status = 'setup').
  timer_mode text not null default 'periods' check (timer_mode in ('periods', 'rounds')),
  period_seconds int,
  periods_count int not null default 1,
  rounds_to_win int,
  -- Si el cuadro de eliminación genera además el partido por el 3er puesto.
  -- Quedó sin uso (pasó a ser obligatorio en todo cuadro con semifinales);
  -- la columna se deja por si vuelve a hacer falta el toggle por torneo.
  third_place_match boolean not null default true,
  unique (event_id, discipline_id, category_id)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  name text not null,
  institution text,
  -- De dónde es el equipo. Provincia de la lista de
  -- lib/argentina-locations.ts; localidad elegida de una lista (Neuquén y
  -- Río Negro) o escrita a mano (resto del país). Obligatorias en la
  -- inscripción pública, opcionales en el resto (equipos viejos).
  province text,
  locality text,
  -- Datos del adulto responsable (mentor/profesor). `mentor_contact` guarda
  -- "celular · email" en una línea, solo para mostrar. Nada de datos de
  -- menores más allá de los nombres de pila de `member_names`.
  mentor_name text,
  mentor_contact text,
  -- Cantidad de integrantes — se deriva de la lista `member_names`.
  member_count int,
  -- Nombres de las personas del equipo y de los robots — texto libre, uno
  -- por línea o separados por coma, solo para mostrar (no una tabla aparte).
  -- `robot_names` se pide únicamente en fútbol robótico.
  member_names text,
  robot_names text,
  notes text,
  -- Cuándo se tildó "Leí y acepto las bases y condiciones" en la inscripción
  -- pública — null si el equipo se cargó a mano desde el panel.
  accepted_terms_at timestamptz,
  -- Acreditación + homologación técnica: un equipo que no esté acreditado Y
  -- homologado no entra al sorteo de grupos. Invariante: homologado ⟹
  -- acreditado (lo fuerzan las Server Actions, no un constraint).
  accredited boolean not null default false,
  accredited_at timestamptz,
  homologated boolean not null default false,
  homologated_at timestamptz,
  -- Cantidad de integrantes efectivamente presentes (solo el número, para
  -- saber cuántos premios entregar).
  participants_present int,
  -- Orden de siembra manual — solo relevante en format_type = 'bracket_only'
  -- (cuadro sin fase de grupos). NULL = se usa el orden de created_at.
  seed_order int,
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
  -- Posición final asignada a mano por el admin, para resolver un empate
  -- entre 3+ equipos que get_group_standings no puede desempatar solo
  -- (empate en puntos + diferencia + goles a favor). NULL = orden automático.
  manual_rank_override int,
  primary key (group_id, team_id)
);

-- Canchas del evento, compartidas entre disciplinas. `access_token` es el
-- link del juez, por eso `anon` nunca ve esa columna (grant por columna +
-- vista courts_public más abajo).
create table courts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  access_token uuid not null default gen_random_uuid() unique,
  sort_order int not null default 0,
  -- Disciplina para la que la cancha está armada físicamente (color/orden en
  -- el panel, aviso al asignar una cancha de otra disciplina). NULL permitido.
  discipline_id uuid references disciplines (id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  phase text not null check (phase in ('group', 'bracket')),
  group_id uuid references groups (id) on delete cascade,
  -- 'gold' / 'silver' solo en format_type = 'gold_silver'; NULL en el resto.
  bracket_type text check (bracket_type in ('gold', 'silver')),
  round text,          -- 'R16' | 'QF' | 'SF' | 'F' | '3P' ... NULL en grupos
  bracket_slot int,    -- posición dentro de la ronda, para armar el árbol
  next_match_id uuid references matches (id),
  next_match_slot text check (next_match_slot in ('a', 'b')),
  -- Partido por el 3er puesto al que va el PERDEDOR de esta semifinal
  -- (análogo a next_match_id/slot para el ganador). NULL fuera de las semis.
  consolation_match_id uuid references matches (id),
  consolation_slot text check (consolation_slot in ('a', 'b')),
  team_a_id uuid references teams (id),
  team_b_id uuid references teams (id),
  court_id uuid references courts (id),
  turno int,           -- orden dentro del cronograma (detección de choques)
  status text not null default 'pending_teams'
    check (status in ('pending_teams', 'scheduled', 'in_progress', 'completed')),
  score_a int,
  score_b int,
  winner_id uuid references teams (id),
  -- Cuándo el juez abrió el partido por primera vez (distinto del reloj).
  started_at timestamptz,
  -- Reloj pausable del período/ronda ACTUAL. Restante =
  --   period_seconds - timer_elapsed_seconds
  --   - (timer_running_since is not null ? now() - timer_running_since : 0)
  timer_running_since timestamptz,
  timer_elapsed_seconds int not null default 0,
  current_period int not null default 1,
  round_winner_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tarjetas (amarilla/roja) por equipo dentro de un partido. "Doble amarilla
-- = roja" es una regla de visualización (lib/match-cards.ts): se guardan 2
-- filas 'yellow', no se deriva una fila 'red'.
create table match_cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  card_type text not null check (card_type in ('yellow', 'red')),
  reason text,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- ÍNDICES
-- ==========================================================================

create index idx_matches_competition on matches (competition_id);
create index idx_matches_court_turno on matches (court_id, turno);
create index idx_matches_group on matches (group_id);
create index idx_teams_competition on teams (competition_id);
create index idx_groups_competition on groups (competition_id);
create index idx_courts_event on courts (event_id);
create index idx_courts_discipline on courts (discipline_id);
create index match_cards_match_id_idx on match_cards (match_id);

-- ==========================================================================
-- TRIGGER: matches.updated_at
-- ==========================================================================

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
-- FUNCIÓN: tabla de posiciones de un grupo
-- (puntos → diferencia de gol → goles a favor → nombre; el
--  manual_rank_override del admin tiene prioridad sobre todo eso)
-- ==========================================================================

create or replace function get_group_standings(p_group_id uuid)
returns table (
  team_id uuid,
  team_name text,
  member_names text,
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
    t.member_names,
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
  group by t.id, t.name, t.member_names, gt2.manual_rank_override
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
-- HELPERS DE RLS (security definer para no depender de la RLS de la tabla
-- que consultan; stable para que Postgres memoice la llamada por consulta)
-- ==========================================================================

create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql stable security definer set search_path = public;

create or replace function is_superadmin() returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'superadmin');
$$ language sql stable security definer set search_path = public;

-- Administra el evento: superusuario o figura en event_admins.
create or replace function can_manage_event(p_event_id uuid) returns boolean as $$
  select is_superadmin()
    or exists (select 1 from event_admins where event_id = p_event_id and user_id = auth.uid());
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_competition(p_competition_id uuid) returns boolean as $$
  select coalesce((select can_manage_event(event_id) from competitions where id = p_competition_id), false);
$$ language sql stable security definer set search_path = public;

-- Quien crea un evento queda como su administrador.
create or replace function add_event_creator_as_admin() returns trigger as $$
begin
  if new.created_by is not null and exists (select 1 from admins where user_id = new.created_by) then
    insert into event_admins (event_id, user_id, added_by)
    values (new.id, new.created_by, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger events_add_creator_as_admin
  after insert on events
  for each row execute function add_event_creator_as_admin();

create or replace function event_is_public(p_event_id uuid) returns boolean as $$
  select coalesce((select is_public from events where id = p_event_id), false);
$$ language sql stable security definer set search_path = public;

create or replace function competition_is_public(p_competition_id uuid) returns boolean as $$
  select coalesce((
    select e.is_public
    from competitions c
    join events e on e.id = c.event_id
    where c.id = p_competition_id
  ), false);
$$ language sql stable security definer set search_path = public;

-- ==========================================================================
-- ROW LEVEL SECURITY
--   · Escritura: superusuario (is_superadmin()) sobre todo; administrador
--     de eventos (can_manage_event) sobre sus eventos y lo que cuelga.
--   · Lectura pública: solo filas que cuelgan de un evento is_public = true.
--     El admin ve todo. Los clientes con service-role key (juez, inscripción,
--     acreditación) ignoran RLS y validan el token a mano en la app.
--   · disciplines / categories: lectura pública total (catálogos fijos).
-- ==========================================================================

alter table disciplines  enable row level security;
alter table categories   enable row level security;
alter table events        enable row level security;
alter table competitions  enable row level security;
alter table teams         enable row level security;
alter table groups        enable row level security;
alter table group_teams   enable row level security;
alter table courts        enable row level security;
alter table matches       enable row level security;
alter table match_cards   enable row level security;
alter table admins        enable row level security;

alter table event_admins  enable row level security;

-- ---- lectura ----
-- Lo público (eventos is_public) lo ve cualquiera; además cada admin ve lo
-- de los eventos que administra (can_manage_*), el superusuario todo.
create policy "public read disciplines" on disciplines for select using (true);
create policy "public read categories"  on categories  for select using (true);

create policy "public read events" on events
  for select using (is_public or created_by = auth.uid() or can_manage_event(id));

create policy "public read competitions" on competitions
  for select using (event_is_public(event_id) or can_manage_event(event_id));

create policy "public read teams" on teams
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

create policy "public read groups" on groups
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

create policy "public read group_teams" on group_teams
  for select using (
    exists (
      select 1 from groups g
      where g.id = group_teams.group_id
        and (competition_is_public(g.competition_id) or can_manage_competition(g.competition_id))
    )
  );

create policy "public read courts" on courts
  for select using (event_is_public(event_id) or can_manage_event(event_id));

create policy "public read matches" on matches
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

create policy "public read match_cards" on match_cards
  for select using (
    exists (
      select 1 from matches m
      where m.id = match_cards.match_id
        and (competition_is_public(m.competition_id) or can_manage_competition(m.competition_id))
    )
  );

-- Cualquier admin lee la lista de admins (para compartir). Alta/baja/rol:
-- solo desde el servidor con service_role (app/admin/(protected)/usuarios).
create policy "admin read admins" on admins for select using (is_admin());

-- ---- escritura/administración ----
-- Catálogos globales: solo el superusuario.
create policy "admin all disciplines" on disciplines for all using (is_superadmin()) with check (is_superadmin());
create policy "admin all categories"  on categories  for all using (is_superadmin()) with check (is_superadmin());

-- Eventos: cualquier admin crea (a su nombre); edita/borra quien lo administra.
create policy "admin insert events" on events for insert with check (is_admin() and created_by = auth.uid());
create policy "admin update events" on events for update using (can_manage_event(id)) with check (can_manage_event(id));
create policy "admin delete events" on events for delete using (can_manage_event(id));

create policy "admin all competitions" on competitions
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));
create policy "admin all courts" on courts
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));
create policy "admin all teams" on teams
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));
create policy "admin all groups" on groups
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));
create policy "admin all matches" on matches
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));
create policy "admin all group_teams" on group_teams
  for all
  using (exists (select 1 from groups g where g.id = group_teams.group_id and can_manage_competition(g.competition_id)))
  with check (exists (select 1 from groups g where g.id = group_teams.group_id and can_manage_competition(g.competition_id)));
create policy "admin all match_cards" on match_cards
  for all
  using (exists (select 1 from matches m where m.id = match_cards.match_id and can_manage_competition(m.competition_id)))
  with check (exists (select 1 from matches m where m.id = match_cards.match_id and can_manage_competition(m.competition_id)));

-- Compartir evento: lo gestiona quien administra ese evento.
create policy "manage event_admins" on event_admins
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));

-- ==========================================================================
-- VISTA: canchas para la sección pública (sin access_token).
-- security_invoker: hereda la RLS de `courts` del rol que consulta.
-- ==========================================================================

create view courts_public
  with (security_invoker = true)
  as select id, event_id, name, sort_order, discipline_id from courts;

-- ==========================================================================
-- GRANTS
--   La `anon` key es pública (viaja en el HTML). Sobre las tablas con
--   columnas sensibles se REVOCA el select de tabla (que en Supabase viene
--   de los privilegios por defecto) y se re-otorga SOLO por columna.
--   `authenticated` (admin logueado) conserva el acceso de tabla completa;
--   la RLS de arriba es la que efectivamente lo limita.
-- ==========================================================================

grant execute on function is_admin()                    to anon, authenticated;
grant execute on function get_group_standings(uuid)     to anon, authenticated;
grant execute on function event_is_public(uuid)         to anon, authenticated;
grant execute on function competition_is_public(uuid)   to anon, authenticated;
grant execute on function is_superadmin()               to anon, authenticated;
grant execute on function can_manage_event(uuid)        to anon, authenticated;
grant execute on function can_manage_competition(uuid)  to anon, authenticated;

-- catálogos y tablas sin datos sensibles: select completo
grant select on disciplines, categories, competitions, groups, group_teams, matches, match_cards
  to anon, authenticated;

-- events: anon solo columnas públicas (nunca accreditation_token)
revoke select on events from anon;
grant select (id, name, event_date, status, created_at, is_public) on events to anon;

-- teams: anon solo lo que muestran la sección pública / los kioscos
revoke select on teams from anon;
grant select (id, competition_id, name, institution, member_names, robot_names, seed_order, created_at)
  on teams to anon;

-- courts: anon solo columnas seguras (nunca access_token); usa courts_public
revoke select on courts from anon;
grant select (id, event_id, name, sort_order, discipline_id) on courts to anon;

grant select on courts_public to anon, authenticated;
grant select on admins to authenticated;

-- escritura a nivel tabla para `authenticated`; la RLS (is_admin()) es la
-- que realmente restringe a los usuarios de `admins`
grant insert, update, delete on
  disciplines, categories, events, competitions, teams, groups, group_teams, courts, matches, match_cards
  to authenticated;

-- Desde el 30/10/2026 Supabase deja de otorgar privilegios por defecto a
-- las tablas nuevas de `public` (ver 0016_explicit_grants.sql): todo lo que
-- antes venía "de regalo" se declara explícito acá.

-- admin logueado: lectura completa de las tablas que arriba sólo tienen
-- escritura (la RLS con is_admin() es la que limita)
grant select on events, teams, courts to authenticated;

-- service_role (createAdminClient: juez, acreditación, inscripción,
-- scripts) — acceso completo; se saltea la RLS
grant select, insert, update, delete on
  disciplines, categories, events, admins, competitions, teams, groups,
  group_teams, courts, matches, match_cards
  to service_role;
grant select on courts_public to service_role;

-- compartir eventos (0018): nada para anon
revoke all on event_admins from anon;
grant select, insert, delete on event_admins to authenticated;
grant select, insert, update, delete on event_admins to service_role;

-- ==========================================================================
-- REALTIME: la vista pública, el modo pantalla y el panel del juez se
-- subscriben a `matches` y `match_cards` para actualizarse solos.
-- ==========================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_cards'
  ) then
    alter publication supabase_realtime add table match_cards;
  end if;
end $$;

-- ==========================================================================
-- SEEDS: disciplinas y categorías fijas de la Liga.
-- Los defaults de cronómetro salen de los reglamentos técnicos 2026
-- (sumo/mini sumo: mejor de 3, asaltos de 2 min; fútbol: 2 tiempos de 3 min).
-- ==========================================================================

insert into disciplines
  (slug, name, allow_draws_default, sort_order,
   timer_mode_default, period_seconds_default, periods_count_default, rounds_to_win_default)
values
  ('futbol',            'Fútbol Robótico',    true,  1, 'periods', 180, 2, null),
  ('sumo_autonomo',     'Sumo Autónomo',      false, 2, 'rounds',  120, 3, 2),
  ('sumo_rc',           'Sumo RC',            false, 3, 'rounds',  120, 3, 2),
  ('minisumo_autonomo', 'Mini Sumo Autónomo', false, 4, 'rounds',  120, 3, 2),
  ('minisumo_rc',       'Mini Sumo RC',       false, 5, 'rounds',  120, 3, 2);

insert into categories (slug, name, min_age, max_age, sort_order) values
  ('infantil',        'Infantil',        7,  12,   1),
  ('juvenil_adultos', 'Juvenil/Adultos', 13, null, 2);
