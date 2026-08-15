-- Fase 5: visibilidad pública del evento (público/privado).
-- Antes, apenas se creaba un evento ya aparecía en /publico y en el inicio
-- (aunque estuviera "draft" y sin nada cargado todavía) — el admin no tenía
-- forma de armarlo tranquilo antes de mostrarlo. `is_public` es independiente
-- del `status` (borrador/activo/finalizado sigue siendo el estado del
-- evento en sí); esto es solo un tapa-ojos para la sección pública.
-- Aplicar en el SQL Editor de Supabase, después de 0001..0004.

alter table events add column if not exists is_public boolean not null default true;

-- Mismo patrón que 0003_accreditation.sql: `anon` solo tiene grant de
-- columnas puntuales sobre `events` (no la tabla completa), hay que sumar
-- la columna nueva a mano.
grant select (is_public) on events to anon;
