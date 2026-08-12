-- Fase 2: cronómetro de partido, inscripción pública de equipos.
-- Migración puramente aditiva (ALTER TABLE ADD COLUMN) — no toca datos existentes.
-- Aplicar en el SQL Editor de Supabase, igual que 0001_init.sql.

-- Timestamp de cuando el juez abre el partido (arranca el cronómetro).
alter table matches add column if not exists started_at timestamptz;

-- El admin habilita/deshabilita la inscripción pública por torneo (competencia).
alter table competitions add column if not exists registration_open boolean not null default false;

-- Datos del adulto responsable del equipo, cargados en el auto-registro público.
-- Nada de datos de menores: coherente con el alcance original del sistema.
alter table teams add column if not exists mentor_name text;
alter table teams add column if not exists mentor_contact text;
alter table teams add column if not exists member_count int;
alter table teams add column if not exists notes text;
