-- ==========================================================================
-- Restringe qué columnas de `teams` puede leer `anon` (la anon key es
-- pública: está en el HTML de todo el sitio).
--
-- Desde 0001_init.sql `teams` tenía "public read teams using(true)" + grant
-- de la TABLA COMPLETA a anon. Migraciones posteriores le sumaron datos de
-- contacto del adulto responsable (mentor_name, mentor_contact = teléfono +
-- email, 0002), notas de texto libre (notes, 0002) y aceptación de bases
-- (accepted_terms_at, 0010). Con el grant de tabla completa, cualquiera
-- podía hacer  GET /rest/v1/teams?select=mentor_contact,notes  con la anon
-- key y llevarse esos datos de todos los equipos.
--
-- Mismo patrón que ya se usó para events.accreditation_token
-- (0003_accreditation.sql) y courts.access_token (courts_public en
-- 0001_init.sql): se revoca el select de tabla y se re-otorga solo sobre
-- las columnas que la sección pública / kiosco realmente muestran
-- (nombre del equipo, institución, integrantes y robots — todo texto ya
-- visible en /publico, la pantalla y el link del juez).
--
-- `authenticated` (el admin logueado) conserva el grant de tabla completa
-- de 0001_init.sql — RLS "admin all teams" ya lo limita a la mesa de
-- jueces. La mesa de acreditación y la inscripción pública escriben con la
-- service-role key (createAdminClient), que ignora grants y RLS, así que no
-- las afecta.
--
-- Nota PostgREST: un `select("*")` de una consulta anónima NO rompe con
-- esto — PostgREST expande `*` a las columnas que el rol puede leer. Las
-- consultas de servidor que hoy piden "*" (build-event-tab-items.tsx, etc.)
-- simplemente reciben menos columnas cuando corren sin sesión.
-- ==========================================================================

revoke select on teams from anon;

grant select (
  id,
  competition_id,
  name,
  institution,
  member_names,
  robot_names,
  seed_order,
  created_at
) on teams to anon;
