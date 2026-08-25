-- ==========================================================================
-- Robots del equipo (fútbol robótico se arma con 2 robots titulares + 1
-- suplente opcional, a diferencia de sumo/mini sumo donde el equipo ES un
-- solo robot) y aceptación de bases y condiciones en la inscripción
-- pública.
--
-- `robot_names` sigue el mismo criterio que `member_names`
-- (0008_team_member_names.sql): texto libre, un robot por línea, solo para
-- mostrar — no hace falta una tabla aparte. `accepted_terms_at` guarda
-- CUÁNDO se tildó el checkbox de bases y condiciones (no solo un booleano)
-- para tener registro ante cualquier reclamo.
-- ==========================================================================

alter table teams add column if not exists robot_names text;
alter table teams add column if not exists accepted_terms_at timestamptz;
