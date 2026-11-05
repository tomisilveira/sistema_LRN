-- ==========================================================================
-- Encuesta de satisfacción a familias (nov 2026).
-- Spec: docs/encuesta-satisfaccion/SPEC.md. Página pública:
-- /encuesta-satisfaccion?t=<token>; vista admin: /admin/encuesta.
--
--   · encuesta_tokens: un token aleatorio (128 bits, base64url, generado en
--     el server con crypto.randomBytes) por equipo inscripto. Va en el link
--     que se manda por mail; NUNCA es el id del equipo. Sirve para vincular
--     la respuesta a evento / disciplina / categoría / localidad sin
--     preguntarlos.
--   · encuesta_satisfaccion_familias: las respuestas. Varias familias de un
--     mismo equipo reciben el mismo link, así que la fila se identifica por
--     `respondent_id` (uuid aleatorio que genera el navegador y guarda en
--     localStorage): una respuesta por persona/navegador, que se actualiza si
--     vuelve a enviar. `token`/`inscripcion_id` quedan null si se respondió
--     sin link.
--
-- Nada de datos de menores: solo dos textos libres opcionales, sin nombre
-- ni edad. El mail del adulto se guarda SOLO con acepta_contacto (check).
--
-- Escritura: solo el server con service_role (Server Action con validación
-- y rate limit); anon no tiene ningún grant. Lectura: admins vía RLS — el
-- superadmin ve todo, un event_admin solo las respuestas de equipos de sus
-- eventos.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ==========================================================================

create table if not exists encuesta_tokens (
  token text primary key check (length(token) >= 22),
  team_id uuid not null unique references teams (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists encuesta_satisfaccion_familias (
  id uuid primary key default gen_random_uuid(),
  respondent_id uuid not null unique,
  token text references encuesta_tokens (token) on delete set null,
  inscripcion_id uuid references teams (id) on delete set null,

  quien_responde text not null check (quien_responde in ('padres', 'docente', 'mayor')),

  experiencia smallint check (experiencia between 1 and 5),
  que_conto text check (length(que_conto) <= 2000),
  primera_vez text check (primera_vez in ('primera', 'regional', '2025')),
  nps smallint check (nps between 0 and 10),

  como_se_entero jsonb not null default '[]'::jsonb check (jsonb_typeof(como_se_entero) = 'array'),
  conocia_anide text check (conocia_anide in ('si', 'suena', 'no')),
  sede_cercana text check (sede_cercana in ('si', 'no', 'quiero_info')),

  info_previa text check (info_previa in ('si', 'mas_o_menos', 'no')),
  puntaje_comodidad smallint check (puntaje_comodidad between 1 and 5),
  puntaje_seguridad smallint check (puntaje_seguridad between 1 and 5),
  puntaje_esperas smallint check (puntaje_esperas between 1 and 5),
  horas_total text check (horas_total in ('<3', '3-6', '>6')),
  momento_malo text check (length(momento_malo) <= 2000),

  volveria_2027 text check (volveria_2027 in ('si', 'tal_vez', 'no')),
  interes_propuestas jsonb not null default '[]'::jsonb check (jsonb_typeof(interes_propuestas) = 'array'),
  acepta_contacto boolean not null default false,
  email_contacto text check (length(email_contacto) <= 254),
  cambiaria text check (length(cambiaria) <= 2000),
  chico_mas_gusto text check (length(chico_mas_gusto) <= 2000),
  chico_menos_gusto text check (length(chico_menos_gusto) <= 2000),

  user_agent_tipo text check (user_agent_tipo in ('mobile', 'desktop')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- El mail solo existe con el consentimiento marcado.
  constraint encuesta_email_solo_con_consentimiento
    check (acepta_contacto or email_contacto is null)
);

create index if not exists encuesta_familias_inscripcion_idx
  on encuesta_satisfaccion_familias (inscripcion_id);

drop trigger if exists encuesta_familias_updated_at on encuesta_satisfaccion_familias;
create trigger encuesta_familias_updated_at
  before update on encuesta_satisfaccion_familias
  for each row execute function set_updated_at();

alter table encuesta_tokens enable row level security;
alter table encuesta_satisfaccion_familias enable row level security;

drop policy if exists "admin read encuesta_tokens" on encuesta_tokens;
create policy "admin read encuesta_tokens" on encuesta_tokens for select
  using (exists (select 1 from teams t where t.id = team_id and can_manage_competition(t.competition_id)));

drop policy if exists "admin insert encuesta_tokens" on encuesta_tokens;
create policy "admin insert encuesta_tokens" on encuesta_tokens for insert
  with check (exists (select 1 from teams t where t.id = team_id and can_manage_competition(t.competition_id)));

drop policy if exists "admin read encuesta_familias" on encuesta_satisfaccion_familias;
create policy "admin read encuesta_familias" on encuesta_satisfaccion_familias for select
  using (
    is_superadmin()
    or (inscripcion_id is not null and exists (
      select 1 from teams t where t.id = inscripcion_id and can_manage_competition(t.competition_id)
    ))
  );

-- Grants explícitos (regla de 0016). anon: nada.
revoke all on encuesta_tokens, encuesta_satisfaccion_familias from anon;
grant select, insert on encuesta_tokens to authenticated;
grant select on encuesta_satisfaccion_familias to authenticated;
grant select, insert, update, delete on encuesta_tokens, encuesta_satisfaccion_familias to service_role;
