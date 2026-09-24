-- ==========================================================================
-- Multiusuario: superusuario + administradores de sus propios eventos.
--
-- Hasta acá cualquier fila de `admins` veía y editaba TODO. Ahora:
--   · admins.role = 'superadmin' → ve y edita todo, da de alta usuarios,
--     administra disciplinas y categorías (catálogos globales).
--   · admins.role = 'event_admin' → solo los eventos donde figura en
--     `event_admins` (y todo lo que cuelga de ellos: torneos, equipos,
--     canchas, partidos...). Puede crear eventos (quedan como suyos, ver
--     trigger) y compartir los suyos con otros admins que ya existan.
--
-- La restricción vive en la RLS, no solo en la UI: el panel escribe con la
-- sesión del usuario (createServerSupabaseClient), así que un event_admin
-- no puede tocar un evento ajeno aunque arme el request a mano. Los kioscos
-- (juez, acreditación, inscripción) usan service_role + token y no cambian.
--
-- La lectura PÚBLICA no cambia (eventos is_public siguen visibles para
-- todos, logueado o no). Por eso el panel filtra además en la app qué
-- eventos listar (lib/admin-auth.ts): un event_admin logueado igual "ve"
-- por RLS los eventos públicos ajenos, pero no los administra.
--
-- Aplicar en el SQL Editor de Supabase ANTES de desplegar el código.
-- Idempotente.
-- ==========================================================================

-- ---- roles -----------------------------------------------------------------

alter table admins add column if not exists role text not null default 'event_admin';
alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('superadmin', 'event_admin'));

-- Email copiado de auth.users: `authenticated` no puede leer auth.users, y
-- el panel necesita mostrar "con quién está compartido" y elegir a quién
-- compartir. Se completa al dar de alta (app/admin/(protected)/usuarios).
alter table admins add column if not exists email text;

update admins a
set email = u.email
from auth.users u
where u.id = a.user_id and a.email is null;

-- Los admins que existían antes de esto veían todo: pasan a superadmin para
-- que nadie pierda acceso con la migración (hoy es uno solo). Solo corre la
-- primera vez (si ya hay un superadmin, no toca nada).
update admins set role = 'superadmin'
where not exists (select 1 from admins where role = 'superadmin');

-- ---- dueño del evento ------------------------------------------------------

alter table events add column if not exists created_by uuid default auth.uid() references auth.users (id) on delete set null;

-- ---- quién administra qué evento --------------------------------------------

create table if not exists event_admins (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references admins (user_id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_admins_user_idx on event_admins (user_id);

-- ---- helpers de RLS ----------------------------------------------------------

create or replace function is_superadmin() returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'superadmin');
$$ language sql stable security definer set search_path = public;

-- Solo cuenta event_admins (al creador lo agrega el trigger de abajo): así,
-- si el creador deja de compartirse el evento a sí mismo, pierde el acceso
-- de verdad. `created_by` queda solo como dato histórico + para que la
-- policy de lectura deje ver la fila recién insertada.
create or replace function can_manage_event(p_event_id uuid) returns boolean as $$
  select is_superadmin()
    or exists (select 1 from event_admins where event_id = p_event_id and user_id = auth.uid());
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_competition(p_competition_id uuid) returns boolean as $$
  select coalesce((select can_manage_event(event_id) from competitions where id = p_competition_id), false);
$$ language sql stable security definer set search_path = public;

grant execute on function is_superadmin()              to anon, authenticated;
grant execute on function can_manage_event(uuid)       to anon, authenticated;
grant execute on function can_manage_competition(uuid) to anon, authenticated;

-- Quien crea un evento queda como su administrador (si es admin).
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

drop trigger if exists events_add_creator_as_admin on events;
create trigger events_add_creator_as_admin
  after insert on events
  for each row execute function add_event_creator_as_admin();

-- ---- RLS: lectura --------------------------------------------------------------
-- Mismo criterio público de siempre; lo que cambia es el "bypass" de admin:
-- antes is_admin() (cualquier admin), ahora solo quien administra ese evento.

drop policy if exists "public read events" on events;
create policy "public read events" on events
  for select using (is_public or created_by = auth.uid() or can_manage_event(id));

drop policy if exists "public read competitions" on competitions;
create policy "public read competitions" on competitions
  for select using (event_is_public(event_id) or can_manage_event(event_id));

drop policy if exists "public read teams" on teams;
create policy "public read teams" on teams
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

drop policy if exists "public read groups" on groups;
create policy "public read groups" on groups
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

drop policy if exists "public read group_teams" on group_teams;
create policy "public read group_teams" on group_teams
  for select using (
    exists (
      select 1 from groups g
      where g.id = group_teams.group_id
        and (competition_is_public(g.competition_id) or can_manage_competition(g.competition_id))
    )
  );

drop policy if exists "public read courts" on courts;
create policy "public read courts" on courts
  for select using (event_is_public(event_id) or can_manage_event(event_id));

drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches
  for select using (competition_is_public(competition_id) or can_manage_competition(competition_id));

drop policy if exists "public read match_cards" on match_cards;
create policy "public read match_cards" on match_cards
  for select using (
    exists (
      select 1 from matches m
      where m.id = match_cards.match_id
        and (competition_is_public(m.competition_id) or can_manage_competition(m.competition_id))
    )
  );

-- ---- RLS: escritura ------------------------------------------------------------

-- Catálogos globales: solo el superusuario.
drop policy if exists "admin all disciplines" on disciplines;
create policy "admin all disciplines" on disciplines
  for all using (is_superadmin()) with check (is_superadmin());

drop policy if exists "admin all categories" on categories;
create policy "admin all categories" on categories
  for all using (is_superadmin()) with check (is_superadmin());

-- Eventos: cualquier admin crea (y queda como dueño); edita/borra quien lo
-- administra. `created_by` se fuerza al usuario actual (no se puede crear un
-- evento "a nombre de" otro).
drop policy if exists "admin all events" on events;
drop policy if exists "admin insert events" on events;
drop policy if exists "admin update events" on events;
drop policy if exists "admin delete events" on events;
create policy "admin insert events" on events
  for insert with check (is_admin() and created_by = auth.uid());
create policy "admin update events" on events
  for update using (can_manage_event(id)) with check (can_manage_event(id));
create policy "admin delete events" on events
  for delete using (can_manage_event(id));

drop policy if exists "admin all competitions" on competitions;
create policy "admin all competitions" on competitions
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));

drop policy if exists "admin all courts" on courts;
create policy "admin all courts" on courts
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));

drop policy if exists "admin all teams" on teams;
create policy "admin all teams" on teams
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));

drop policy if exists "admin all groups" on groups;
create policy "admin all groups" on groups
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));

drop policy if exists "admin all matches" on matches;
create policy "admin all matches" on matches
  for all using (can_manage_competition(competition_id)) with check (can_manage_competition(competition_id));

drop policy if exists "admin all group_teams" on group_teams;
create policy "admin all group_teams" on group_teams
  for all
  using (exists (select 1 from groups g where g.id = group_teams.group_id and can_manage_competition(g.competition_id)))
  with check (exists (select 1 from groups g where g.id = group_teams.group_id and can_manage_competition(g.competition_id)));

drop policy if exists "admin all match_cards" on match_cards;
create policy "admin all match_cards" on match_cards
  for all
  using (exists (select 1 from matches m where m.id = match_cards.match_id and can_manage_competition(m.competition_id)))
  with check (exists (select 1 from matches m where m.id = match_cards.match_id and can_manage_competition(m.competition_id)));

-- admins: cualquier admin lee la lista (para elegir con quién compartir). El
-- alta/baja/cambio de rol lo hace el servidor con service_role después de
-- verificar que quien lo pide es superadmin — no hay policy de escritura.
-- (La policy "admin read admins" de 0001 sigue igual.)

-- event_admins: lo ve y lo edita quien administra ese evento. Solo se puede
-- compartir con alguien que ya sea admin (FK a admins).
alter table event_admins enable row level security;

drop policy if exists "manage event_admins" on event_admins;
create policy "manage event_admins" on event_admins
  for all using (can_manage_event(event_id)) with check (can_manage_event(event_id));

-- Grants explícitos de la tabla nueva (desde el 30/10/2026 Supabase no los
-- da por defecto, ver 0016). Nada para anon: hasta esa fecha los
-- privilegios por defecto todavía se los darían, así que se revocan.
revoke all on event_admins from anon;
grant select, insert, delete on event_admins to authenticated;
grant select, insert, update, delete on event_admins to service_role;

-- Los eventos que ya existían quedan como del superusuario actual (dueño
-- histórico) — no cambia su acceso (el superadmin ve todo igual), pero así
-- aparecen como "suyos" en la lista de administradores del evento.
insert into event_admins (event_id, user_id, added_by)
select e.id, a.user_id, a.user_id
from events e
cross join lateral (select user_id from admins where role = 'superadmin' order by created_at limit 1) a
on conflict do nothing;
