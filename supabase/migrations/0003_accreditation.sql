-- Fase 3: acreditación + homologación técnica como gate antes del sorteo
-- de grupos, y conteo de participantes presentes por equipo.
-- Aplicar en el SQL Editor de Supabase, después de 0001_init.sql y
-- 0002_features.sql.

alter table teams add column if not exists accredited boolean not null default false;
alter table teams add column if not exists accredited_at timestamptz;
alter table teams add column if not exists homologated boolean not null default false;
alter table teams add column if not exists homologated_at timestamptz;
-- Cantidad de integrantes que efectivamente se presentaron (no nombres —
-- solo para saber cuántos premios entregar; coherente con no manejar datos
-- de menores).
alter table teams add column if not exists participants_present int;

-- Link único de acreditación del evento (sin login, como el de cancha, pero
-- a nivel evento porque una sola mesa de acreditación atiende equipos de
-- cualquier disciplina del día).
alter table events add column if not exists accreditation_token uuid not null default gen_random_uuid() unique;

-- events se lee público (RLS "public read events" using(true)), y RLS no
-- filtra columnas — el grant de tabla completa a `anon` desde 0001_init.sql
-- dejaría el token nuevo legible por cualquiera con la anon key. Se
-- restringe a columnas explícitas, igual que se protegió courts.access_token
-- con la vista courts_public.
revoke select on events from anon;
grant select (id, name, event_date, status, created_at) on events to anon;
-- `authenticated` (admin) ya tenía grant de tabla completa desde
-- 0001_init.sql; eso sigue cubriendo la columna nueva automáticamente.
