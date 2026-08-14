-- Fase 4: canchas con disciplina asignada.
-- Las canchas siguen siendo del evento (se comparten entre varios torneos:
-- ej. dos categorías de mini sumo usan la misma cancha de mini sumo, o tres
-- torneos de sumo se reparten dos canchas de sumo a lo largo del día), pero
-- ahora cada cancha declara para qué disciplina está armada físicamente.
-- Eso permite: 1) colorearlas/agruparlas en el panel, 2) avisar en el
-- combo de "asignar cancha" de un partido cuando la cancha elegida es de
-- otra disciplina, sin bloquear la carga (el admin puede necesitar
-- reasignar sobre la marcha durante la jornada).
-- Aplicar en el SQL Editor de Supabase, después de 0001, 0002 y 0003.

alter table courts add column if not exists discipline_id uuid references disciplines (id);
create index if not exists idx_courts_discipline on courts (discipline_id);

-- La vista pública de canchas suma la disciplina (mismo criterio de siempre:
-- expone todo salvo access_token).
drop view if exists courts_public;
create view courts_public as
  select id, event_id, name, sort_order, discipline_id from courts;

grant select on courts_public to anon, authenticated;
