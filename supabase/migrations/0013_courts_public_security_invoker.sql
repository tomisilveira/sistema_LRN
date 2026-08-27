-- ==========================================================================
-- `courts_public` deja de ser una vista SECURITY DEFINER.
--
-- Contexto: en 0001 se creó `courts_public` como vista que corre con los
-- permisos del dueño, para exponer nombre/orden/disciplina de las canchas a
-- `anon` SIN darle ningún acceso a la tabla `courts` (que tiene el
-- `access_token`, el link secreto del juez). Funcionaba, pero:
--   1) el advisor de Supabase marca toda vista security-definer como CRITICAL
--      (saltea la RLS del que consulta),
--   2) la vista no filtraba por `events.is_public`, así que los NOMBRES de
--      cancha de un evento privado quedaban visibles (menor, pero real —
--      hermano de lo que 0012 cerró para el resto de las tablas).
--
-- Fix: darle a `anon` un grant por columna sobre `courts` (sin
-- `access_token`, igual que teams en 0011 / events en 0003), una policy de
-- lectura pública gateada por `event_is_public()` (de 0012), y recrear la
-- vista como `security_invoker` para que herede esa RLS. El código no
-- cambia: `lib/build-court-boards.ts` sigue leyendo `courts_public`.
-- ==========================================================================

-- Lectura por columna para anon — nunca `access_token`.
grant select (id, event_id, name, sort_order, discipline_id) on courts to anon;

-- RLS: anon/authenticated ven canchas de eventos públicos; el admin, todas.
-- (La policy "admin all courts" de 0001 sigue existiendo y es permisiva —
-- se combinan con OR.)
drop policy if exists "public read courts" on courts;
create policy "public read courts" on courts
  for select using (is_admin() or event_is_public(event_id));

-- Recrear la vista sin SECURITY DEFINER. Con security_invoker la vista
-- chequea permisos y RLS con el rol que consulta, así que ahora sí respeta
-- el grant por columna y la policy de arriba.
drop view if exists courts_public;
create view courts_public
  with (security_invoker = true)
  as select id, event_id, name, sort_order, discipline_id from courts;

grant select on courts_public to anon, authenticated;
