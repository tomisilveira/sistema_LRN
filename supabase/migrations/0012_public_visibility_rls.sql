-- ==========================================================================
-- Hace que `events.is_public` sea una barrera de datos real, no solo un
-- filtro en la UI.
--
-- Hasta 0011 las policies de lectura de events/competitions/teams/groups/
-- group_teams/matches/match_cards eran todas `using (true)`: cualquiera con
-- la anon key (pública) podía leer por la REST API el contenido completo de
-- un evento marcado "privado" enumerando UUIDs. Las páginas lo ocultaban,
-- los datos no.
--
-- Ahora anon/authenticated solo leen filas que cuelgan de un evento con
-- is_public = true; `is_admin()` sigue viendo todo. Los clientes con
-- service-role key (juez, acreditación, inscripción — createAdminClient)
-- ignoran RLS, así que no se ven afectados.
--
-- Rollback: volver cada policy a `using (true)` y dropear las 2 funciones
-- del final.
-- ==========================================================================

-- Helpers security definer (mismo patrón que is_admin() en 0001_init.sql):
-- evitan que la policy dependa de poder leer events/competitions por RLS y
-- son STABLE, así Postgres memoiza la llamada dentro de una misma consulta
-- (todas las filas de `matches` de un torneo comparten competition_id).

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

grant execute on function event_is_public(uuid) to anon, authenticated;
grant execute on function competition_is_public(uuid) to anon, authenticated;

-- ---- events ----
drop policy if exists "public read events" on events;
create policy "public read events" on events
  for select using (is_public or is_admin());

-- ---- competitions ----
drop policy if exists "public read competitions" on competitions;
create policy "public read competitions" on competitions
  for select using (is_admin() or event_is_public(event_id));

-- ---- teams ----
drop policy if exists "public read teams" on teams;
create policy "public read teams" on teams
  for select using (is_admin() or competition_is_public(competition_id));

-- ---- groups ----
drop policy if exists "public read groups" on groups;
create policy "public read groups" on groups
  for select using (is_admin() or competition_is_public(competition_id));

-- ---- group_teams (sin columna de evento/competencia: se pasa por groups) ----
drop policy if exists "public read group_teams" on group_teams;
create policy "public read group_teams" on group_teams
  for select using (
    is_admin() or exists (
      select 1 from groups g
      where g.id = group_teams.group_id
        and competition_is_public(g.competition_id)
    )
  );

-- ---- matches ----
drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches
  for select using (is_admin() or competition_is_public(competition_id));

-- ---- match_cards (0009) ----
drop policy if exists "public read match_cards" on match_cards;
create policy "public read match_cards" on match_cards
  for select using (
    is_admin() or exists (
      select 1 from matches m
      where m.id = match_cards.match_id
        and competition_is_public(m.competition_id)
    )
  );

-- disciplines y categories quedan con lectura pública total a propósito: son
-- catálogos fijos sembrados en 0001, no cuelgan de ningún evento.
