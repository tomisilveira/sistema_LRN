-- ==========================================================================
-- Encuesta de satisfacción: devolución del equipo (nov 2026).
--
--   · como_se_entero_otro: el "¿cuál?" al marcar "Otro" en "¿Cómo te
--     enteraste de la Liga?". (Las opciones nuevas 'boca_a_boca' y 'otro' van
--     en el jsonb como_se_entero: no hace falta tocar la tabla para eso.)
--   · acompanamiento_referente: "¿Se sintió acompañado/a por su docente o
--     referente durante la jornada?" (familias y participantes).
--   · experiencia_equipo: "¿Cómo vivió la Liga el equipo que acompañaste?"
--     (solo docentes / referentes de sede).
--   · puntaje_organizacion: "Disponibilidad y atención de la organización",
--     1 a 5, junto a los otros puntajes.
--
-- El server solo completa cada columna para el público al que se le
-- pregunta (lib/encuesta/validate.ts). Si se despliega antes de aplicar
-- esto, las respuestas se guardan igual, sin estas columnas.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ==========================================================================

alter table encuesta_satisfaccion_familias
  add column if not exists como_se_entero_otro text check (length(como_se_entero_otro) <= 2000),
  add column if not exists acompanamiento_referente text check (acompanamiento_referente in ('si', 'mas_o_menos', 'no')),
  add column if not exists experiencia_equipo smallint check (experiencia_equipo between 1 and 5),
  add column if not exists puntaje_organizacion smallint check (puntaje_organizacion between 1 and 5);
