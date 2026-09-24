-- ==========================================================================
-- Provincia y localidad de cada equipo.
--
-- La inscripción pública ahora pide de dónde es el equipo: provincia de una
-- lista (Neuquén y Río Negro primero) y localidad elegida de una lista para
-- Neuquén/Río Negro o escrita a mano para el resto del país (ver
-- lib/argentina-locations.ts y app/components/location-fields.tsx).
--
-- Texto libre a propósito (no tablas de provincias/localidades): la lista
-- vive en el código y se valida en lib/team-input.ts. Nullable: los equipos
-- cargados antes de esto no tienen el dato.
--
-- Grants: `authenticated` y `service_role` tienen privilegios a nivel TABLA
-- sobre `teams` (ver 0016), que cubren columnas nuevas solas. `anon` tiene
-- grant POR COLUMNA (0011) y a propósito NO se le agregan estas: el sitio
-- público no las muestra.
--
-- Aplicar en el SQL Editor de Supabase ANTES de desplegar el código que las
-- usa — si no, la inscripción falla al insertar.
-- ==========================================================================

alter table teams add column if not exists province text;
alter table teams add column if not exists locality text;

comment on column teams.province is 'Provincia del equipo (lista de lib/argentina-locations.ts).';
comment on column teams.locality is 'Localidad del equipo: de la lista para Neuquén/Río Negro, escrita a mano para el resto.';
