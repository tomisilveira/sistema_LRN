# Liga Robótica Neuquina — Sistema de Jornada

Sistema web para administrar y visualizar en vivo las jornadas de competencia
de la Liga Robótica Neuquina: carga de resultados de fase de grupos y
eliminatoria simple, tablas de posiciones y cuadros, en tiempo real, con 3
vistas (juez de cancha, admin, público).

Ver el detalle funcional y las decisiones de alcance en
[`.claude` / conversación original] — resumen rápido abajo.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Realtime + Auth) — plan gratuito alcanza de sobra para un evento de un día

## Alcance de esta versión

Implementado end-to-end: fase de grupos + eliminatoria simple, para una
competencia (disciplina × categoría) a la vez, con las 3 pantallas
funcionando en tiempo real, más:

- **Canchas del evento** (compartidas entre todas las disciplinas del día):
  se cargan de una sola vez preguntando la cantidad, antes de poder crear el
  primer torneo.
- **Inscripción pública de equipos**: el admin habilita/deshabilita por
  torneo un link sin login donde los equipos se auto-registran (nombre,
  institución, mentor responsable — nada de datos de menores).
- **Cronómetro de partido**: el juez "abre" el partido cuando los equipos
  están listos en la cancha (arranca el cronómetro) y recién ahí puede
  cargar el resultado.
- **Avance automático de fase**: al completarse todos los partidos de
  grupo de un torneo, el sistema genera solo el cuadro eliminatorio (o
  marca el torneo terminado si es solo fase de grupos) — el botón manual
  sigue disponible como respaldo.
- **Sugerencia de formato**: según cantidad de inscriptos y canchas
  disponibles, el panel recomienda "solo grupos" vs. "grupos + eliminatoria
  estilo Copa del Mundo" (no vinculante, el admin puede elegir otra cosa
  mientras el torneo esté en `setup`).
- **Modo claro/oscuro** del panel admin (toggle en el header, no afecta la
  vista pública ni la del juez).

El modelo de datos ya soporta las 10 combinaciones disciplina×categoría y
tiene reservado el formato "oro/plata" (`gold_silver`), pero **su UI y
lógica de generación de cuadro doble todavía no están implementadas** — es
la siguiente pasada natural sobre este mismo schema. Tampoco hay UI para
correr y administrar varias competencias en simultáneo desde una sola
pantalla (se puede crear cualquier cantidad de competencias por evento, pero
cada una se administra entrando a su propia página).

El desempate automático de la tabla de posiciones cubre puntos → diferencia
de gol → goles a favor. Un empate entre 3+ equipos en esos tres criterios no
se resuelve solo (el enfrentamiento directo entre 3+ equipos requeriría una
sub-liguilla); el admin lo resuelve a mano cargando un "orden manual" por
equipo en la tabla de posiciones, que tiene prioridad sobre el cálculo
automático.

**El puntaje default (victoria 3 / empate 1 / derrota 0, más el orden de
desempate) es configurable por competencia, pero no está formalizado
todavía en el Reglamento General de la Liga** — confirmar con la
organización antes de dar el sistema por cerrado, tal como señala el spec
original.

## 1. Crear el proyecto de Supabase

1. Andá a [supabase.com](https://supabase.com), creá una cuenta/proyecto
   gratuito (elegí una región cercana, ej. São Paulo).
2. En **Project Settings → API** copiá:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (Reveal) → `SUPABASE_SERVICE_ROLE_KEY` — **no la
     compartas ni la subas a git**, solo se usa server-side.
3. Copiá `.env.local.example` a `.env.local` y completá esos tres valores.

## 2. Aplicar el schema

En el SQL Editor del proyecto Supabase, pegá y ejecutá, **en orden**:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
   tablas, RLS, función de posiciones, seeds de disciplinas/categorías.
2. [`supabase/migrations/0002_features.sql`](supabase/migrations/0002_features.sql) —
   cronómetro de partido, inscripción pública (agrega columnas, no rompe
   datos existentes).

(Si preferís la CLI de Supabase: `supabase link` y después `supabase db
push` aplica ambas migraciones en orden.)

## 3. Crear tu usuario admin

1. En el dashboard de Supabase: **Authentication → Users → Add user**,
   creá tu usuario (email + contraseña).
2. En el **SQL Editor**, habilitalo como admin (reemplazá el email):

   ```sql
   insert into admins (user_id)
   select id from auth.users where email = 'tu-email@ejemplo.com';
   ```

## 4. Instalar dependencias y correr en local

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`:

- `/publico` — vista pública, sin login
- `/admin` — panel de administración (pide login)
- `/juez/[courtToken]` — panel del juez (el link se genera desde el admin,
  al crear una cancha dentro de un evento)

### Cargar datos de prueba (opcional)

Para probar el flujo completo sin cargar todo a mano:

```bash
npm run seed:demo
```

Crea un evento demo con una competencia de Fútbol Robótico Juvenil/Adultos,
8 equipos en 2 grupos, 2 canchas y los partidos de fase de grupos ya
generados (sin resultados). Al final imprime los links directos al admin y
a la vista pública.

## 5. Deploy

- **Vercel** (recomendado): importar el repo, cargar las 3 variables de
  entorno del paso 1 en el proyecto de Vercel, deploy. No hace falta
  configuración adicional — Next.js corre tal cual.
- Supabase ya queda corriendo en la nube desde el paso 1; no hay backend
  propio que desplegar aparte del sitio Next.js.

## Flujo de uso el día del evento

1. **Antes del evento**, desde `/admin`: crear el evento y, en su página,
   cargar cuántas canchas hay (se crean solas). Recién ahí se puede crear un
   torneo por cada disciplina/categoría que corre ese día.
2. En cada torneo: revisar la sugerencia de formato, cargar equipos a mano
   o (recomendado) activar "Inscripción pública" y compartir ese link con
   los mentores para que se auto-registren. Cuando estén todos, armar los
   grupos (manual o sorteo), generar los partidos de todos-contra-todos y
   asignarles cancha + turno.
3. Compartir el link de cada cancha (botón "Copiar link de juez" en la
   página del evento) con el juez correspondiente — lo abre en su celular,
   sin login. El juez abre cada partido cuando los equipos están listos
   (arranca el cronómetro) y carga el resultado al terminar.
4. Compartir el link de `/publico/[eventId]/[competitionId]` de cada
   torneo para proyectar en pantalla o que la gente lo abra desde su
   celular.
5. A medida que los jueces cargan resultados, las tablas de posiciones se
   actualizan solas en el admin y en la vista pública. Cuando termina la
   fase de grupos de un torneo, el cuadro eliminatorio se genera solo (si
   el torneo es "grupos + eliminatoria"); si es "solo grupos", el torneo
   queda marcado como terminado.

## Estructura del proyecto

```
app/
  admin/            panel de administración (protegido con Supabase Auth, modo claro/oscuro)
  juez/[courtToken] panel del juez de cancha (sin login, token por cancha, cronómetro)
  publico/          vista pública en vivo (sin login)
  inscripcion/[competitionId]  auto-registro público de equipos (sin login)
  api/matches/[matchId]/result   endpoint que usa el juez para cargar resultados
  api/matches/[matchId]/start    endpoint que usa el juez para abrir/cancelar un partido
lib/
  bracket.ts                        lógica pura de armado de cuadro (seeding, byes)
  bracket-actions.ts                persistencia del cuadro + avance automático de ganadores
  generate-bracket-for-competition.ts  arma el cuadro de una competencia (manual o automático)
  advance-competition-phase.ts      dispara generación de cuadro / cierre de torneo solo
  format-recommendation.ts          sugerencia de formato según inscriptos y canchas
  match-logic.ts                    cómputo de resultado (marcador o ganador directo)
  judge-auth.ts                     validación del token de cancha (compartida por los 2 endpoints del juez)
  round-robin.ts                    generación de partidos todos-contra-todos
  supabase/                         clientes de Supabase (browser, server, admin/service-role)
supabase/migrations/  schema SQL + RLS + seeds (0001 init, 0002 features)
scripts/seed-demo.ts  datos de prueba
```
