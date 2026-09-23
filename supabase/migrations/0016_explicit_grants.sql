-- ==========================================================================
-- Privilegios explícitos para `authenticated` y `service_role`.
--
-- A partir del 30/10/2026 Supabase deja de otorgar automáticamente acceso a
-- la Data API (PostgREST / supabase-js) a las tablas NUEVAS de `public` —
-- también las creadas por migraciones, en proyectos nuevos o en un
-- `supabase db reset`. Las tablas existentes conservan sus permisos, así que
-- en producción esto no cambia nada (los grants ya existen por los
-- privilegios por defecto; volver a otorgarlos es un no-op).
--
-- Pero las migraciones 0001..0015 dependían de esos defaults para:
--   - `authenticated` (admin): select de events, teams y courts (sólo se
--     le otorgaba escritura explícita; courts ni siquiera figuraba).
--   - `service_role` (createAdminClient: juez, acreditación, inscripción,
--     scripts): nunca se le otorgó nada explícito.
-- Sin esto, reconstruir la base desde las migraciones después de esa fecha
-- deja al admin sin ver sus eventos y al juez con "permission denied".
--
-- Regla de acá en adelante: toda migración que cree una tabla incluye sus
-- grants en el mismo archivo (anon/authenticated/service_role).
-- Idempotente. Aplicar en el SQL Editor de Supabase.
-- ==========================================================================

grant select on events, teams, courts to authenticated;

grant select, insert, update, delete on
  disciplines, categories, events, admins, competitions, teams, groups,
  group_teams, courts, matches, match_cards
  to service_role;

grant select on courts_public to service_role;
