-- ==========================================================================
-- Partido por el 3er puesto en el cuadro de eliminación.
--
-- Hasta ahora el cuadro llegaba sólo hasta la Final (`round = 'F'`): no
-- había forma de definir 3º/4º. Esta migración agrega:
--   - `matches.consolation_match_id` / `consolation_slot`: las dos
--     semifinales apuntan al partido por el 3er puesto, igual que
--     `next_match_id`/`next_match_slot` apuntan a la final. El PERDEDOR de
--     cada semi se empuja a ese partido (ver lib/bracket-actions.ts →
--     advanceWinner).
--   - `competitions.third_place_match`: toggle por torneo, prendido por
--     defecto. Se lee al generar el cuadro (lib/generate-bracket-for-competition.ts).
--
-- `matches.round` es texto libre sin CHECK, así que `'3P'` no necesita
-- tocar ninguna constraint. `anon`/`authenticated` ya tienen grant de tabla
-- completa sobre `matches` (0001_init.sql) — las columnas nuevas quedan
-- cubiertas solas, igual que en 0006. Migración puramente aditiva.
-- Aplicar en el SQL Editor de Supabase, después de 0001..0013.
-- ==========================================================================

alter table matches add column if not exists consolation_match_id uuid references matches (id);
alter table matches add column if not exists consolation_slot text check (consolation_slot in ('a', 'b'));

comment on column matches.consolation_match_id is
  'Partido por el 3er puesto al que va el PERDEDOR de esta semifinal (análogo a next_match_id para el ganador). NULL fuera de las semifinales.';

alter table competitions add column if not exists third_place_match boolean not null default true;

comment on column competitions.third_place_match is
  'Si el cuadro de eliminación genera además el partido por el 3er puesto (round = 3P). Default true.';
