-- ==========================================================================
-- Todos contra todos con varias vueltas (oct 2026).
--
--   · competitions.round_robin_legs: cuántas veces se enfrenta cada par de
--     equipos en la fase de grupos (1 = todos contra todos simple, como
--     hasta ahora). Pensado para grupos chicos donde se quiere jugar más,
--     ej. 3 equipos que se enfrentan 4 veces cada uno. "Iniciar torneo"
--     arma esa cantidad de vueltas (alternando quién va primero) y la tabla
--     de posiciones ya suma todos los partidos (get_group_standings no
--     asume un partido por par).
--
-- `anon` y `authenticated` leen competitions entera (grant de tabla), así
-- que no hace falta grant nuevo.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente. El código funciona
-- sin ella (asume 1 vuelta), pero no deja guardar más de 1.
-- ==========================================================================

alter table competitions add column if not exists round_robin_legs int not null default 1;
alter table competitions drop constraint if exists competitions_round_robin_legs_check;
alter table competitions add constraint competitions_round_robin_legs_check check (round_robin_legs between 1 and 6);
