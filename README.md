# Liga Robótica Neuquina — Sistema de Jornada

Aplicación web para administrar y mostrar en vivo las jornadas de competencia
de la Liga Robótica Neuquina (fútbol robótico, sumo y mini sumo, autónomo y
radio-controlado, categorías infantil y juvenil/adultos).

Cubre todo el día del evento: inscripción de equipos, acreditación y
homologación técnica, sorteo de grupos, fase de todos-contra-todos, cuadros
de eliminación (incluido 3er puesto), cronómetro de cancha, carga de
resultados y tarjetas, tablas de posiciones y una vista pública / modo
pantalla que se actualizan solos por WebSocket.

No hay backend propio: Next.js habla directo con Postgres a través de
Supabase, y toda la autorización vive en Row Level Security.

---

## Stack

| Pieza | Qué se usa |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Server Components + Server Actions) |
| Lenguaje | TypeScript (modo estricto) |
| Estilos | Tailwind CSS v4 |
| Base de datos | Postgres gestionado por [Supabase](https://supabase.com) |
| Auth | Supabase Auth (email + contraseña, solo para el panel admin) |
| Tiempo real | Supabase Realtime (canal sobre `matches` y `match_cards`) |
| Export | `exceljs` (planilla del evento) |
| Deploy sugerido | Vercel (frontend) + Supabase (datos), ambos en plan gratuito |

El plan gratuito de Supabase alcanza de sobra para un evento de un día.

---

## Pantallas

| Ruta | Login | Para qué |
|---|---|---|
| `/` | no | Inicio: jornada en vivo + próximas fechas |
| `/publico` · `/publico/[eventId]` · `/publico/[eventId]/[competitionId]` | no | Vista pública en vivo (posiciones, partidos, cuadros); deep-link a un torneo puntual para QR en cancha |
| `/evento/[eventId]/pantalla` | no | Modo pantalla para proyector: partidos en vivo y, si no hay, fallback de posiciones/cuadros |
| `/inscripcion/[eventId]` | no | Auto-registro público: un link por jornada, el equipo elige disciplina y categoría (solo las de inscripción abierta) |
| `/acreditacion/[eventToken]` | no | Mesa de acreditación: marcar acreditado/homologado, contar presentes, corregir/mover/agregar equipos |
| `/juez/[courtToken]` | no | Panel del juez de cancha: abrir partido, cronómetro pausable, marcador en vivo, tarjetas, cierre |
| `/admin/login` | — | Ingreso del panel |
| `/admin` · `/admin/eventos/[eventId]` · `/admin/competencias/[competitionId]` · `/admin/categorias` · `/admin/disciplinas` | sí | Panel de administración completo |

Las pantallas sin login se autentican con un **token opaco en la URL**
(`courtToken`, `eventToken`, o el `eventId` para inscripción). Ver
[Modelo de seguridad](#modelo-de-seguridad).

---

## Modelo de datos (resumen)

```
events ──┬── competitions ──┬── teams ──── group_teams ──┐
         │                  │                            │
         ├── courts         ├── groups ──────────────────┘
         │                  │
         │                  └── matches ──── match_cards
         │
disciplines / categories   (catálogos fijos, sembrados en schema.sql)
admins                     (user_id → auth.users, habilita el panel)
```

- **`events`** — la jornada. `status` (`draft`/`active`/`finished`) e
  `is_public` (visibilidad en la sección pública) son independientes.
- **`competitions`** — un torneo = disciplina × categoría dentro de un evento
  (único por esa tripleta). Guarda formato, puntajes, config de cronómetro y
  `status` (`setup` → `groups_in_progress` → `groups_done` →
  `bracket_in_progress` → `finished`).
- **`courts`** — canchas del evento, compartidas entre disciplinas. Cada una
  tiene un `access_token` (link del juez) y una `discipline_id` opcional para
  color/orden.
- **`teams`** — datos del equipo, integrantes y robots (texto libre, solo
  para mostrar), responsable adulto, flags de acreditación/homologación.
  Nada de datos de menores más allá de los nombres de pila que carga el
  propio equipo.
- **`matches`** — un partido. Sirve para grupos y para cuadro
  (`next_match_id`/`consolation_match_id` arman el árbol). Incluye el estado
  del reloj pausable del período/ronda actual.
- **`get_group_standings(group_id)`** — función SQL que calcula la tabla de
  posiciones (puntos → diferencia → goles a favor → nombre), respetando el
  `manual_rank_override` que el admin puede fijar para desempatar 3+ equipos.

Formatos soportados (`competitions.format_type`):

| Valor | Descripción |
|---|---|
| `groups_only` | Solo fase de grupos |
| `single_elimination` | Grupos + cuadro de eliminación simple |
| `gold_silver` | Grupos + cuadro oro (clasificados) y cuadro plata (resto) |
| `bracket_only` | Cuadro directo sin grupos, con siembra manual (`teams.seed_order`) |

---

## Puesta en marcha

### 1. Proyecto de Supabase

1. Creá una cuenta y un proyecto gratuito en
   [supabase.com](https://supabase.com) (región cercana, ej. São Paulo).
2. En **Project Settings → API** anotá:
   - `Project URL`
   - `anon public` key (segura para el navegador: RLS la limita)
   - `service_role` key (**Reveal**) — bypassea RLS, **nunca** al navegador
     ni a git.

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`.env.local` está en `.gitignore` — no se commitea.

### 3. Aplicar el schema

**Base nueva** — en el **SQL Editor** del proyecto, pegá y ejecutá el archivo
completo [`supabase/schema.sql`](supabase/schema.sql). Crea todo de una vez:
tablas, índices, funciones, RLS, grants por columna, la vista `courts_public`,
los seeds de disciplinas/categorías y la publicación de Realtime.

**Base existente de una versión anterior** — aplicá solo las migraciones de
[`supabase/migrations/`](supabase/migrations/) que te falten, en orden. Cada
archivo tiene un encabezado que explica qué hace y son todas aditivas (salvo
`0001`).

`schema.sql` y `migrations/` describen **el mismo estado final**:
`migrations/` es la historia incremental (útil para actualizar una base vieja
y para entender por qué cada cosa es como es); `schema.sql` es el resultado
consolidado, para arrancar de cero sin correr 15 archivos. Si tocás una,
actualizá la otra.

> Con la CLI de Supabase: `supabase db push` aplica `migrations/` en orden.

### 4. Usuario admin

1. **Authentication → Users → Add user**: creá tu usuario (email + contraseña).
2. En el **SQL Editor**, habilitalo (reemplazá el email):

   ```sql
   insert into admins (user_id)
   select id from auth.users where email = 'tu-email@ejemplo.com';
   ```

### 5. Correr en local

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000` → `/admin/login`.

---

## Datos de prueba (opcional)

Todos los scripts necesitan `NEXT_PUBLIC_SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (corren fuera de una sesión de
Supabase Auth).

| Comando | Qué deja cargado |
|---|---|
| `npm run seed:demo` | 1 evento, 1 torneo de fútbol, 8 equipos en 2 grupos, 2 canchas, fase de grupos generada sin resultados |
| `npm run seed:full-demo` | 1 evento con varios torneos en distintos estados (grupos a medias, cuadro en curso, combate por rounds en vivo) para mirar la UI en movimiento |
| `node --env-file=.env.local --import tsx scripts/sim-1-setup.ts` | Simulación E2E: 10 torneos (5 disciplinas × 2 categorías, los 4 formatos), equipos y fase de grupos jugada casi entera |
| `node --env-file=.env.local --import tsx scripts/sim-2-finish.ts` | Termina lo que dejó `sim-1`, genera y juega los cuadros, cierra el evento |

`scripts/sim-lib.ts` reimplementa parte de la lógica `server-only`
(`lib/apply-auto-schedule.ts`, `lib/bracket-actions.ts`,
`lib/generate-bracket-for-competition.ts`,
`lib/advance-competition-phase.ts`) porque esos módulos no se pueden importar
fuera del build de Next. Si cambia esa lógica, hay que re-sincronizar las
copias.

---

## Deploy

- **Vercel**: importar el repo, cargar las 3 variables de entorno del paso 1,
  deploy. No hace falta configuración extra.
- Supabase ya corre en la nube desde el paso 1; no hay otro backend que
  desplegar.
- El sitio setea cabeceras de seguridad conservadoras
  (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) desde `next.config.ts`. Todavía
  **no hay Content-Security-Policy** — es el próximo paso natural del
  endurecimiento.

---

## Modelo de seguridad

La autorización está en la base, no en la UI.

- **RLS en todas las tablas.** Escritura solo para usuarios de la tabla
  `admins` (`is_admin()`). Lectura pública **acotada a eventos con
  `is_public = true`** (`event_is_public()` / `competition_is_public()`) — un
  evento privado no se puede leer por la REST API enumerando UUIDs.
- **La `anon` key es pública** (viaja en el HTML). Las columnas sensibles
  (`courts.access_token`, `events.accreditation_token`,
  `teams.mentor_contact`, `teams.notes`) están fuera del grant de `anon`:
  se otorga `select` **por columna**, no sobre la tabla entera (ver la
  sección GRANTS de `schema.sql`).
- **La `service_role` key solo se usa server-side** en:
  - `lib/supabase/admin.ts` (protegido con `import "server-only"`),
  - los Route Handlers del juez (`app/api/matches/[matchId]/*`),
  - las Server Actions públicas de inscripción y acreditación.

  En todos esos casos no hay sesión de Supabase Auth, así que **antes de
  escribir se re-valida a mano el token** (`lib/judge-auth.ts` para la
  cancha; chequeo de `accreditation_token` / `registration_open` para las
  demás) y que el recurso pertenezca a ese evento/torneo.
- **Los tokens de kiosco van en la URL** (`/juez/<token>`,
  `/acreditacion/<token>`). Es un compromiso deliberado para que jueces y
  mesa de acreditación entren desde el celular sin login. Quien tiene el
  link puede operar esa cancha / esa acreditación: compartilos con cuidado y
  no los pegues en lugares indexables.
- **Sin rate limiting.** La inscripción pública podría spamearse; para un
  evento de un día se asume aceptable, pero si se expone por mucho tiempo
  conviene sumar un límite.
- **`npm audit`**: `exceljs` arrastra `uuid < 11.1.1` (severidad *moderate*,
  solo afecta a `uuid` v3/v5/v6 con `buffer` explícito — no es la ruta que
  usa `exceljs`). No hay fix sin downgrade mayor de `exceljs`; se revisa
  cuando saquen release.

`npm run lint` y `npx tsc --noEmit` pasan sin warnings.

---

## Estructura del proyecto

```
app/
  page.tsx                     inicio público
  publico/                     vista pública en vivo (switcher de jornadas y torneos)
  evento/[eventId]/pantalla/   modo pantalla para proyector
  inscripcion/[eventId]/       auto-registro público (un link por jornada, elige disciplina + categoría)
  acreditacion/[eventToken]/   mesa de acreditación (sin login, token del evento)
  juez/[courtToken]/           panel del juez de cancha (sin login, token de cancha)
  admin/
    login/
    (protected)/               panel: eventos, torneos, categorías, disciplinas
  api/
    matches/[matchId]/         endpoints del juez (start, result, pause/resume,
                               advance-period, round-result, round-tie, card, live-score)
    eventos/[eventId]/export/  planilla Excel del evento (requiere sesión admin)
  components/                   UI compartida (kiosk/public shells, realtime, brackets...)

lib/
  supabase/                    clientes: client (browser), server (SSR), admin (service-role)
  judge-auth.ts                validación del token de cancha, compartida por los endpoints del juez
  round-robin.ts               generación de partidos todos-contra-todos
  bracket.ts                   armado puro del cuadro (seeding, byes)
  bracket-actions.ts           persistencia del cuadro + avance de ganadores y 3er puesto
  generate-bracket-for-competition.ts   arma el/los cuadro(s) según format_type
  advance-competition-phase.ts cierre de grupos → cuadro / torneo terminado
  auto-schedule.ts             asignación automática de cancha + turno
  match-logic.ts               cómputo de resultado (marcador o ganador directo)
  match-timer.ts               fórmula del reloj pausable (compartida server/cliente)
  match-cards.ts               tarjetas + regla "doble amarilla = roja"
  format-recommendation.ts     sugerencia "solo grupos" vs "grupos + cuadro"
  database.types.ts            tipos del schema, mantenidos a mano

supabase/schema.sql            schema completo consolidado (para bases nuevas)
supabase/migrations/           las 15 migraciones incrementales, en orden (historia / bases viejas)
scripts/                       seed-demo, seed-full-demo, sim-1-setup, sim-2-finish, sim-lib
```

---

## Flujo de uso el día del evento

1. **Antes**: en `/admin`, crear el evento y cargar cuántas canchas hay. Recién
   ahí se puede crear un torneo por cada disciplina/categoría que corre.
2. En cada torneo: revisar la sugerencia de formato, cargar equipos a mano o
   abrir la **Inscripción pública**. El link de inscripción es **uno solo por
   jornada** (botón junto al título del evento): el equipo elige ahí su
   disciplina y categoría, y solo ve las que tienen la inscripción abierta.
3. Compartir el **link de acreditación** (botón junto al título del evento)
   con la mesa: ahí marcan acreditado + homologado y cuentan presentes. Un
   equipo que no esté acreditado **y** homologado no entra al sorteo.
4. Armar los grupos (manual o sorteo), **Iniciar torneo** (genera el
   todos-contra-todos y asigna cancha + turno solo).
5. Compartir el **link de cada cancha** con su juez. El juez abre el partido
   cuando los equipos están listos, corre el cronómetro y carga el resultado.
6. Proyectar `/evento/[eventId]/pantalla` o compartir `/publico/[eventId]`.
7. A medida que entran resultados, las posiciones se actualizan solas. Al
   cerrarse la fase de grupos, el cuadro se genera solo (o el torneo queda
   terminado si es "solo grupos").
8. Al final: **Exportar a Excel** desde la página del evento para el archivo
   con todos los equipos, partidos y posiciones de la jornada.

---

## Pendientes conocidos

- El puntaje default (3/1/0 + orden de desempate) es configurable por torneo
  pero **no está formalizado en el Reglamento General de la Liga** —
  confirmar con la organización antes de dar el sistema por cerrado.
- No hay una pantalla única para administrar varios torneos en simultáneo:
  cada uno se maneja entrando a su página.
- Un empate entre 3+ equipos en puntos, diferencia y goles a favor no se
  resuelve solo (haría falta una sub-liguilla): el admin carga un "orden
  manual" en la tabla de posiciones.
- Content-Security-Policy y rate limiting, ver [Modelo de seguridad](#modelo-de-seguridad).

---

## Licencia

[MIT](LICENSE).

