-- ==========================================================================
-- Cierra el acceso de `anon` a `courts.access_token`.
--
-- Contexto: 0013 le agregó a `anon` un grant POR COLUMNA sobre `courts`
-- (id, event_id, name, sort_order, discipline_id) y una policy de lectura
-- gateada por `event_is_public()`. Pero NUNCA revocó el `select` de tabla
-- completa que `anon` trae por los privilegios por defecto de Supabase
-- (`ALTER DEFAULT PRIVILEGES ... GRANT SELECT ... TO anon`) — el mismo
-- motivo por el que 0003 hace `revoke select on events from anon` y 0011
-- `revoke select on teams from anon` antes de re-otorgar por columna.
--
-- Resultado hasta acá: con la anon key (pública, está en el HTML del sitio)
-- se podía hacer  GET /rest/v1/courts?select=access_token&event_id=eq.<id>
-- y, para cualquier evento marcado PÚBLICO, llevarse el `access_token` de
-- sus canchas — que es el link del juez (`/juez/<access_token>`), con el que
-- se pueden iniciar partidos y cargar resultados. Con todos los eventos
-- privados la RLS lo tapaba, pero era una bomba de tiempo: alcanzaba con
-- apretar "Hacer público".
--
-- Fix: revocar el select de tabla y re-otorgar sólo las columnas seguras
-- (idénticas a las de 0013). `authenticated` (admin) conserva su acceso —
-- su select de `courts` también viene del default de Supabase y no se toca.
-- La vista `courts_public` (security_invoker, 0013) sigue andando: expone
-- justo esas 5 columnas y `anon` las tiene.
-- Aplicar en el SQL Editor de Supabase.
-- ==========================================================================

revoke select on courts from anon;

grant select (id, event_id, name, sort_order, discipline_id) on courts to anon;
