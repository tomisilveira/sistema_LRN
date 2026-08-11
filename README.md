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

## Alcance de esta versión (MVP)

Implementado end-to-end: fase de grupos + eliminatoria simple, para una
competencia (disciplina × categoría) a la vez, con las 3 pantallas
funcionando en tiempo real.

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

En el SQL Editor del proyecto Supabase, pegá y ejecutá el contenido de
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
(Si preferís la CLI de Supabase: `supabase link` y después `supabase db
push`.)

Esto crea todas las tablas, las políticas de RLS, la función de posiciones,
y carga las 5 disciplinas × 2 categorías de la Liga.

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

1. **Antes del evento**, desde `/admin`: crear el evento, cargar las
   canchas, crear una competencia por cada disciplina/categoría que corre
   ese día (formato, puntaje), cargar los equipos inscriptos, armar los
   grupos (manual o sorteo), generar los partidos de todos-contra-todos y
   asignarles cancha + turno.
2. Compartir el link de cada cancha (botón "Copiar link de juez" en el
   admin) con el juez correspondiente — lo abre en su celular, sin login.
3. Compartir el link de `/publico/[eventId]/[competitionId]` de cada
   competencia para proyectar en pantalla o que la gente lo abra desde su
   celular.
4. A medida que los jueces cargan resultados, las tablas de posiciones y
   (más adelante) el cuadro eliminatorio se actualizan solos en el admin y
   en la vista pública.
5. Cuando la fase de grupos de una competencia termina, desde su página en
   el admin: botón **"Generar cuadro desde posiciones"** arma el cuadro de
   eliminatoria simple con los clasificados de cada grupo.

## Estructura del proyecto

```
app/
  admin/            panel de administración (protegido con Supabase Auth)
  juez/[courtToken] panel del juez de cancha (sin login, token por cancha)
  publico/          vista pública en vivo (sin login)
  api/matches/[matchId]/result   endpoint que usa el juez para cargar resultados
lib/
  bracket.ts          lógica pura de armado de cuadro (seeding, byes)
  bracket-actions.ts  persistencia del cuadro + avance automático de ganadores
  match-logic.ts      cómputo de resultado (marcador o ganador directo)
  round-robin.ts       generación de partidos todos-contra-todos
  supabase/            clientes de Supabase (browser, server, admin/service-role)
supabase/migrations/  schema SQL + RLS + seeds
scripts/seed-demo.ts  datos de prueba
```
