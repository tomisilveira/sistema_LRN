-- ==========================================================================
-- Encuesta de satisfacción: "No sé" en "¿Quiere volver en 2027?" (nov 2026).
--
-- Devolución del equipo: "No sé" es distinto de "Tal vez" (puede no
-- saberlo todavía). Se suma el valor 'no_se' al CHECK de volveria_2027.
-- El nombre del constraint es el que Postgres le puso solo en la 0024.
--
-- Si se despliega antes de aplicar esto, quien elija "No sé" igual guarda
-- la respuesta, sin ese dato (ver app/encuesta-satisfaccion/actions.ts).
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ==========================================================================

alter table encuesta_satisfaccion_familias
  drop constraint if exists encuesta_satisfaccion_familias_volveria_2027_check;

alter table encuesta_satisfaccion_familias
  add constraint encuesta_satisfaccion_familias_volveria_2027_check
  check (volveria_2027 in ('si', 'no', 'tal_vez', 'no_se'));
