-- ==========================================================================
-- Privacidad, segundo paso: anon ya no puede leer teams.member_names (que
-- trae la edad de cada integrante). Lo público pasa por
-- member_names_public (0027).
--
-- Aplicar DESPUÉS de desplegar la versión de la app que lee
-- member_names_public — con la app vieja, las páginas públicas fallan con
-- "permission denied for column member_names".
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ==========================================================================

revoke select (member_names) on teams from anon;
