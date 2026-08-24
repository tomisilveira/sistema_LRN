-- ==========================================================================
-- Tarjetas (amarilla/roja) por equipo dentro de un partido.
--
-- El juez las carga desde la cancha (mismo mecanismo sin sesión de Supabase
-- Auth que result/round-result: valida el access_token de la cancha y
-- escribe con la service-role key, ver app/api/matches/[matchId]/card).
-- "Doble amarilla = roja" es una regla de UI, no de datos: se guarda
-- exactamente lo que pasó (2 filas 'yellow'), y quien las muestra decide
-- tratarlas como roja si hay 2 o más amarillas del mismo equipo en el mismo
-- partido (ver lib/match-cards.ts). Así el historial real queda íntegro.
-- ==========================================================================

create table if not exists match_cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  card_type text not null check (card_type in ('yellow', 'red')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists match_cards_match_id_idx on match_cards(match_id);

alter table match_cards enable row level security;

-- Lectura pública, igual que matches: se muestran en /publico, el modo
-- pantalla y el panel admin sin login.
create policy "public read match_cards" on match_cards for select using (true);

-- Escritura desde el panel admin (sesión real) — el juez de cancha escribe
-- con la service-role key desde el Route Handler, que bypassea RLS
-- directamente y no necesita esta policy.
create policy "admin all match_cards" on match_cards for all using (is_admin()) with check (is_admin());

grant select on match_cards to anon, authenticated;
grant insert, update, delete on match_cards to authenticated;

alter publication supabase_realtime add table match_cards;
