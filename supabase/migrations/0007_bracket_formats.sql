-- Habilita el formato "solo cuadro" (llaves sin fase de grupos) y el orden
-- de siembra manual que ese formato necesita. `gold_silver` y
-- `matches.bracket_type` ('gold'/'silver') ya estaban permitidos por el
-- check constraint desde 0001_init.sql — esta migración solo agrega
-- 'bracket_only' y la columna de siembra; la lógica de generación de los
-- cuadros vive en la app (ver lib/generate-bracket-for-competition.ts).

alter table competitions drop constraint competitions_format_type_check;
alter table competitions add constraint competitions_format_type_check
  check (format_type in ('groups_only', 'single_elimination', 'gold_silver', 'bracket_only'));

alter table teams add column seed_order int;
comment on column teams.seed_order is
  'Orden de siembra manual para competitions.format_type = bracket_only (cuadro sin fase de grupos). NULL = se usa el orden de creación (created_at).';
