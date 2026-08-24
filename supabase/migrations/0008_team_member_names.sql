-- ==========================================================================
-- Nombres de las personas inscriptas con cada equipo/robot.
--
-- Se muestran en todo el sistema como "Nombre del robot" y, debajo, entre
-- paréntesis, los nombres cargados acá (admin, público, modo pantalla,
-- juez, acreditación — sin restricción de categoría, decisión explícita de
-- la organización). Texto libre, una persona por línea o separadas por
-- coma; no hace falta una tabla aparte para esto, es solo para mostrar.
-- ==========================================================================

alter table teams add column if not exists member_names text;

-- get_group_standings devuelve ahora también member_names de cada equipo,
-- para que la tabla de posiciones pueda mostrarlo sin una consulta aparte.
-- Hay que dropearla porque CREATE OR REPLACE no permite cambiar la lista de
-- columnas que devuelve una función; el DROP se lleva los grants, por eso
-- se vuelven a otorgar al final (igual que en 0001_init.sql).
drop function if exists get_group_standings(uuid);

create function get_group_standings(p_group_id uuid)
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

grant execute on function get_group_standings(uuid) to anon, authenticated;
