-- ==========================================================================
-- Robots rotos: W.O. por partido y baja de equipos (oct 2026).
--
--   · matches.forfeit: quién no se presentó ('a', 'b' o 'both'). Con uno
--     solo, gana el otro con marcador fijo (fútbol 3–0, sumo/mini sumo
--     rounds_to_win–0). Con los dos, en grupos queda 0–0 y NINGUNO suma
--     puntos (cuenta como partido perdido para ambos), para no mezclarlo
--     con un empate real.
--   · matches.forfeit_auto: el W.O. lo puso el sistema al dar de baja un
--     equipo (no un juez/admin a mano) — "Reincorporar" sólo deshace esos.
--   · teams.withdrawn_at / withdrawn_reason: el equipo se dio de baja (robot
--     roto, no compite más). Sus partidos pendientes se resuelven por W.O.
--     y al armar el cuadro se saltea (entra el siguiente de su grupo).
--   · get_group_standings: aplica la regla del doble W.O. y devuelve
--     `withdrawn` para mostrar la etiqueta BAJA en las tablas.
--
-- Aplicar en el SQL Editor de Supabase ANTES de desplegar el código.
-- Idempotente.
-- ==========================================================================

alter table matches add column if not exists forfeit text;
alter table matches drop constraint if exists matches_forfeit_check;
alter table matches add constraint matches_forfeit_check check (forfeit in ('a', 'b', 'both'));
alter table matches add column if not exists forfeit_auto boolean not null default false;

alter table teams add column if not exists withdrawn_at timestamptz;
alter table teams add column if not exists withdrawn_reason text;

-- La sección pública muestra la etiqueta BAJA (el motivo queda interno).
grant select (withdrawn_at) on teams to anon;

-- Cambia el tipo de retorno (columna nueva `withdrawn`): hay que borrarla
-- y volver a crearla.
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
    gt2.manual_rank_override,
    (t.withdrawn_at is not null) as withdrawn
  from teams t
  join group_teams gt2 on gt2.team_id = t.id and gt2.group_id = p_group_id
  left join team_matches tm on tm.tm_team_id = t.id
  group by t.id, t.name, t.member_names, t.withdrawn_at, gt2.manual_rank_override
  order by
    case when gt2.manual_rank_override is not null then 0 else 1 end,
    gt2.manual_rank_override asc nulls last,
    points desc,
    score_diff desc,
    score_for desc,
    t.name asc;
end;
$$ language plpgsql stable;

grant execute on function get_group_standings(uuid) to anon, authenticated, service_role;
