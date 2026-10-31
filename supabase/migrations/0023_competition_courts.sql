-- ==========================================================================
-- Canchas por torneo (oct 2026).
--
--   · competitions.court_ids: qué canchas usa este torneo (ej. fútbol
--     infantil en las canchas 1-3 y juvenil en la 4-5). null o vacío = todas
--     las canchas de su disciplina, como hasta ahora. Lo respetan "Iniciar
--     torneo", "Armar partidos que falten", la fase final y "Redistribuir
--     canchas" (ver getUsableCourts en lib/apply-auto-schedule.ts y
--     lib/rebalance-courts.ts). Las canchas siguen siendo del evento: esto
--     solo restringe a cuáles se mandan los partidos de ESTE torneo.
--
-- `anon`/`authenticated` leen competitions entera (grant de tabla). Si se
-- borra una cancha, su id queda colgado acá y simplemente se ignora.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente. Sin ella el código
-- usa todas las canchas de la disciplina (como antes).
-- ==========================================================================

alter table competitions add column if not exists court_ids uuid[];
