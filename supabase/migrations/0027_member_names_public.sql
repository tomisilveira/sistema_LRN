-- ==========================================================================
-- Privacidad: la edad de los integrantes deja de ser pública (nov 2026).
--
-- `teams.member_names` guarda "Nombre Apellido (12)", un integrante por
-- línea (ver app/components/member-list-input.tsx). Las edades de menores
-- se pedían para la organización, no para mostrarlas, pero la columna
-- entera estaba habilitada para el rol anon (cualquiera con la anon key
-- podía leerlas desde la API, aunque la pantalla no las mostrara).
--
-- 1) Columna generada `member_names_public`: la misma lista sin el
--    "(edad)" final de cada línea. Se mantiene sola, no hay que tocar las
--    Server Actions que guardan member_names.
-- 2) anon puede leer member_names_public (la 0028 le saca member_names).
-- 3) get_group_standings devuelve los nombres sin edad (la llama anon
--    desde las páginas públicas; la columna de salida sigue llamándose
--    member_names para no tocar a quien la usa).
--
-- ORDEN DE DESPLIEGUE: aplicar ESTA migración, desplegar la app (lee
-- member_names_public), y recién después aplicar la 0028. La app vieja
-- sigue funcionando con esta aplicada.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ==========================================================================

alter table teams
  add column if not exists member_names_public text
  generated always as (
    regexp_replace(member_names, '[ \t]*\(\d{1,2}\)[ \t]*(\r?)$', '\1', 'gn')
  ) stored;

grant select (member_names_public) on teams to anon;

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
  manual_rank_override int,
  withdrawn boolean
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
      -- Doble W.O. (no se presentó ninguno): no es empate.
      case when m.winner_id is null and m.forfeit is distinct from 'both' then 1 else 0 end as is_draw,
      case when (m.winner_id is not null and m.winner_id <> gt.team_id) or m.forfeit = 'both' then 1 else 0 end as is_loss
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
    t.member_names_public,
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
    gt2.manual_rank_override,
    (t.withdrawn_at is not null) as withdrawn
  from teams t
  join group_teams gt2 on gt2.team_id = t.id and gt2.group_id = p_group_id
  left join team_matches tm on tm.tm_team_id = t.id
  group by t.id, t.name, t.member_names_public, t.withdrawn_at, gt2.manual_rank_override
  order by
    case when gt2.manual_rank_override is not null then 0 else 1 end,
    gt2.manual_rank_override asc nulls last,
    points desc,
    score_diff desc,
    score_for desc,
    t.name asc;
end;
$$ language plpgsql stable;

grant execute on function get_group_standings(uuid) to anon, authenticated;
