# Despliegue en nube propia con Docker

Guía para el equipo de infraestructura. Explica qué es el sistema, qué
necesita, cómo construir y correr la imagen, y qué opciones hay para la base
de datos (incluida la migración a infraestructura propia).

> Estado verificado (sep 2026): el build de producción (`output: "standalone"`)
> compila y corre con `node server.js` usando solo variables de runtime; el
> health check responde y el sitio no carga ningún recurso externo (las
> fuentes están dentro del repo). No se pudo construir la imagen Docker en la
> máquina de desarrollo (no tiene Docker): el `Dockerfile` replica
> exactamente ese mismo proceso.

---

## 1. Qué es y cómo se conecta

El sistema tiene **dos piezas**:

1. **La aplicación** (este repo): Next.js 16 / Node.js 24. Un solo proceso
   HTTP en el puerto `3000`. **Sin estado**: no guarda archivos ni sesiones en
   disco (la sesión viaja en cookies). Es lo que va en el contenedor.
2. **Supabase**: la base de datos PostgreSQL más tres servicios que la app
   usa directamente: **Auth** (login de administradores), **API REST**
   (PostgREST, todas las consultas) y **Realtime** (actualización en vivo de
   marcadores y relojes por WebSocket).

```
                    ┌────────────────────────────┐
  Navegadores ─────▶│ Proxy / balanceador (TLS)  │────▶ Contenedor app :3000
  (público, jueces, └────────────────────────────┘            │
   admins, mesa)                                              │ HTTPS (REST, Auth)
        │                                                     ▼
        └──────────── HTTPS + WSS (login, tiempo real) ──▶  Supabase
```

**Ojo con la flecha de abajo:** los navegadores se conectan **directo** a
Supabase (no a través de la app) para iniciar sesión y para el tiempo real.
Por eso la URL de Supabase tiene que ser alcanzable desde donde estén los
usuarios: el público (internet), las tablets de los jueces en la cancha y la
mesa de acreditación.

---

## 2. Qué se necesita de infraestructura (checklist)

**Para la aplicación**

- [ ] **Construir imágenes Docker** (runner de CI con Docker, BuildKit o
      Kaniko) y un **registro** donde publicarlas.
- [ ] Acceso a un **registry npm** durante el build: el público
      (`registry.npmjs.org`) o un espejo interno (Nexus/Artifactory, ver
      `NPM_CONFIG_REGISTRY`). En runtime no hace falta.
- [ ] **1 contenedor** alcanza para una jornada completa. Sugerido:
      **1 GB de RAM** de límite (usa ~200–300 MB) y **0,5–1 vCPU**.
- [ ] **Dominio + certificado TLS** en el proxy/balanceador
      (ej. `liga.neuquen.gob.ar`). El sitio público tiene que ser accesible
      desde **internet**: lo miran familias y equipos desde el celular.
- [ ] **Salida HTTPS desde el contenedor** hacia la URL de Supabase.
- [ ] **Gestión de secretos** para `SUPABASE_SERVICE_ROLE_KEY` (secret de
      Kubernetes, Vault o variable protegida). No va nunca en la imagen.
- [ ] **Logs**: la app escribe a stdout/stderr (formato texto de Next.js).
- [ ] **Health checks**: `GET /api/health` (liveness) y
      `GET /api/health?deep=1` (readiness, verifica Supabase).

**Para la base de datos**: depende de la opción elegida en la sección 7.

---

## 3. Variables de entorno

Hay variables que se **congelan en la imagen durante el build** (Next.js
incrusta las `NEXT_PUBLIC_*` en el JavaScript del navegador) y otras que se
pasan **al contenedor en runtime**. Consecuencia práctica: **una imagen por
ambiente** (test y producción apuntan a Supabase distintos → imágenes
distintas). Plantilla: [`.env.docker.example`](../.env.docker.example).

| Variable | Cuándo | Secreta | Obligatoria | Para qué |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build | no | **sí** | URL de Supabase **tal como la ven los navegadores** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | no¹ | **sí** | Clave pública de Supabase |
| `SITE_URL` | build y runtime | no | recomendada | URL pública del sistema, sin `/` final (vistas previas al compartir links) |
| `SUPABASE_SERVICE_ROLE_KEY` | **runtime** | **SÍ** | **sí** | Clave de servicio: saltea la seguridad de la base. Solo la usa el servidor |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | build | no | solo si hace falta | Ver sección 5 (proxy que reescribe el Host) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | build | sí | solo con >1 réplica | Ver sección 6 |
| `DEPLOYMENT_ID` | build | no | solo con >1 réplica | Ver sección 6 |
| `NPM_CONFIG_REGISTRY` | build | no | solo sin internet | Espejo npm interno |
| `PORT` / `HOSTNAME` | runtime | no | no | Por defecto `3000` / `0.0.0.0` |

¹ La anon key está pensada para ser pública: la protege la seguridad por filas
(RLS) de la base, no el secreto.

---

## 4. Construir y correr

### Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg SITE_URL=https://liga.ejemplo.gob.ar \
  -t registry.interno/sistema-lrn:1.0.0 .

docker run -d --name sistema-lrn -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  -e SITE_URL=https://liga.ejemplo.gob.ar \
  --read-only --tmpfs /tmp --tmpfs /app/.next/cache \
  registry.interno/sistema-lrn:1.0.0

curl http://localhost:3000/api/health?deep=1
# {"status":"ok","supabase":"ok","ms":42}
```

La imagen:

- Multi-etapa sobre `node:24-alpine` (Node 24 LTS). La imagen final solo
  tiene el build `standalone` (~40 MB de app + la base de Node).
- Corre como usuario **sin privilegios** (`nextjs`, uid 1001).
- Soporta **filesystem de solo lectura** (solo escribe en `/tmp` y
  `/app/.next/cache`, que conviene montar como `tmpfs`).
- Trae `HEALTHCHECK` propio.
- Falla el build con un mensaje claro si faltan las dos variables
  obligatorias.

### Docker Compose

Hay un [`docker-compose.yml`](../docker-compose.yml) de ejemplo (una réplica,
solo lectura, sin privilegios, rotación de logs):

```bash
cp .env.docker.example .env.docker   # completar
docker compose --env-file .env.docker up -d --build
```

### Kubernetes (ejemplo)

```yaml
apiVersion: v1
kind: Secret
metadata: { name: sistema-lrn }
type: Opaque
stringData:
  SUPABASE_SERVICE_ROLE_KEY: "eyJ..."
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: sistema-lrn }
spec:
  replicas: 1
  selector: { matchLabels: { app: sistema-lrn } }
  template:
    metadata: { labels: { app: sistema-lrn } }
    spec:
      securityContext: { runAsNonRoot: true, runAsUser: 1001 }
      containers:
        - name: app
          image: registry.interno/sistema-lrn:1.0.0
          ports: [{ containerPort: 3000 }]
          env:
            - { name: SITE_URL, value: "https://liga.ejemplo.gob.ar" }
            - { name: TZ, value: "America/Argentina/Buenos_Aires" }
          envFrom: [{ secretRef: { name: sistema-lrn } }]
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits:   { cpu: "1",  memory: 1Gi }
          livenessProbe:
            httpGet: { path: /api/health, port: 3000 }
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: "/api/health?deep=1", port: 3000 }
            periodSeconds: 15
            failureThreshold: 3
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
            - { name: next-cache, mountPath: /app/.next/cache }
      volumes:
        - { name: tmp, emptyDir: {} }
        - { name: next-cache, emptyDir: {} }
---
apiVersion: v1
kind: Service
metadata: { name: sistema-lrn }
spec:
  selector: { app: sistema-lrn }
  ports: [{ port: 80, targetPort: 3000 }]
```

> La readiness usa `?deep=1` (si Supabase no responde, la réplica sale del
> balanceador); la liveness **no**, porque reiniciar la app no arregla una
> caída de Supabase.

---

## 5. Proxy / balanceador

- **TLS** termina en el proxy; la app habla HTTP plano en `:3000`.
- **Reenviar el `Host` original** (o `X-Forwarded-Host`) y
  `X-Forwarded-Proto: https`. Los botones del panel (Server Actions de
  Next.js) comparan el origen del navegador con el Host como protección
  CSRF: si el proxy lo reescribe, fallan con *"Invalid Server Actions
  request"*. Si no se puede preservar el Host, construir la imagen con
  `SERVER_ACTIONS_ALLOWED_ORIGINS=liga.ejemplo.gob.ar`.
- **Reenviar la IP real del cliente** en `X-Forwarded-For` (o `X-Real-IP`).
  La inscripción pública limita los envíos por IP (30 cada 10 minutos)
  contra el spam: si el proxy no pasa la IP, todas las inscripciones del
  evento cuentan como una sola conexión y el tope se alcanza enseguida.
- **Timeouts** de al menos **60 s** (la exportación a Excel de un evento
  grande tarda unos segundos).
- **WebSockets: no hacen falta hacia la app.** El tiempo real va del
  navegador directo a Supabase (sí hacen falta hacia Supabase si también se
  aloja adentro, ver sección 7B).
- **Caché**: `/_next/static/*` es inmutable (tiene hash en el nombre) y se
  puede cachear para siempre. **No cachear** el HTML ni `/api/*`: todas las
  páginas son dinámicas (muestran resultados en vivo).
- Tamaño de body: el default (1 MB) alcanza.

---

## 6. Réplicas y actualizaciones

- **1 réplica es suficiente** y es lo más simple.
- Con **más de una réplica** (alta disponibilidad):
  - Definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en el build (la misma clave
    en todas las réplicas; generar una vez con `openssl rand -base64 32`).
    Sin esto, los botones fallan al azar con *"Failed to find Server
    Action"*.
  - Definir `DEPLOYMENT_ID` (ej. el tag de la imagen) para que, durante un
    deploy gradual, un navegador con la versión vieja recargue en vez de
    romperse.
  - **No** hacen falta sesiones pegajosas ni caché compartido (Redis): la
    sesión va en cookies y no hay caché de páginas.
  - El tope anti-spam de la inscripción se cuenta en la memoria de cada
    réplica: con N réplicas el tope real es N × 30 envíos cada 10 minutos.
    Alcanza igual para frenar un script; no hace falta un Redis.
- **Actualizar**: construir un tag nuevo y hacer rolling update. Si la
  versión trae cambios de base de datos (archivos nuevos en
  `supabase/migrations/`), **aplicar la migración antes** de desplegar la
  imagen (ver sección 8).

---

## 7. Base de datos: opciones

La app depende de **Supabase completo**, no solo de PostgreSQL: usa su
login (Auth), su API REST y su tiempo real, y la seguridad está escrita
como reglas por fila (RLS) que usan funciones de Supabase (`auth.uid()`,
roles `anon`/`authenticated`/`service_role`). Hay tres caminos:

| | A. Seguir en Supabase Cloud | B. Supabase propio (self-hosted) | C. Solo PostgreSQL propio |
|---|---|---|---|
| Esfuerzo | Ninguno | Medio (1–2 días de infra) | **Reescribir partes del sistema** |
| Datos | Afuera (Supabase, región São Paulo) | Adentro | Adentro |
| Cambios en la app | Ninguno | Ninguno (solo variables y rebuild) | Login, consultas y tiempo real nuevos |
| Mantenimiento | Supabase | Infra propia (actualizaciones, backups) | Infra propia + código |

### 7A. Seguir en Supabase Cloud (recomendado para empezar)

Solo se mueve la app a la nube interna. Requisitos:

- Salida HTTPS del contenedor a `https://<proyecto>.supabase.co`.
- Los usuarios (internet, tablets de jueces) llegan a Supabase por HTTPS y
  **WSS** (`wss://<proyecto>.supabase.co/realtime/v1/...`).
- **Plan Pro** de Supabase recomendado: el plan gratis **pausa el proyecto
  tras 7 días sin actividad** (el sistema queda fuera de línea hasta
  reactivarlo a mano) y no tiene backups diarios.
- Latencia: cada consulta viaja de la nube interna a Supabase. Con el
  proyecto en São Paulo y la nube en Argentina son ~60–80 ms por viaje;
  la app ya agrupa las consultas en paralelo para minimizar el impacto.

### 7B. Supabase self-hosted en la nube interna

Se instala el **stack oficial de Supabase con Docker** en la
infraestructura propia y se mudan los datos. La app no cambia: solo se
reconstruye la imagen con la nueva URL y claves.

**Qué hay que levantar** (documentación oficial:
<https://supabase.com/docs/guides/self-hosting/docker>, versión probada en
la doc: `self-hosted/v0.8.2`):

- Servicios: Postgres, Auth, PostgREST, Realtime, API gateway (Envoy, puerto
  `8000`), Studio (panel web), postgres-meta, Supavisor, Storage y Edge
  Runtime. Opcionales y prescindibles para este sistema: Logflare, Vector,
  imgproxy. **El sistema no usa Storage ni Edge Functions.**
- Mínimo del stack según Supabase: **4 GB de RAM, 2 núcleos, 40 GB SSD**.
- Un **dominio con TLS** para la API (ej. `api-liga.ejemplo.gob.ar` →
  gateway `:8000`), **alcanzable desde internet** con **WebSocket**
  habilitado (tiempo real). Esa es la `NEXT_PUBLIC_SUPABASE_URL` de la app.
- Secretos a generar en el `.env` de Supabase (con sus scripts
  `utils/generate-keys.sh` y `utils/add-new-auth-keys.sh`):
  `POSTGRES_PASSWORD`, `JWT_SECRET`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`,
  `SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`, `VAULT_ENC_KEY`,
  `PG_META_CRYPTO_KEY`.
- URLs: `SUPABASE_PUBLIC_URL` y `API_EXTERNAL_URL` (dominio de la API),
  `SITE_URL` (dominio de la app).
- **Desactivar el registro público de usuarios** en Auth (los usuarios los
  crea el superusuario desde el panel). Verificar el nombre exacto de la
  variable en la versión instalada (en versiones actuales, `DISABLE_SIGNUP`).
  No hace falta configurar mail (SMTP): el sistema no manda correos.
- **Backups** de Postgres (ver sección 9) y el panel Studio **no expuesto a
  internet**.

**Pasos de migración** (desde el Supabase Cloud actual):

1. **Levantar el Supabase propio** vacío y verificar que responde:
   `curl https://api-liga.ejemplo.gob.ar/rest/v1/` (con la anon key).
2. **Crear la estructura**: ejecutar [`supabase/schema.sql`](../supabase/schema.sql)
   en el SQL Editor de Studio (o con `psql`). Crea tablas, funciones, reglas
   de seguridad y la publicación de tiempo real, y siembra disciplinas y
   categorías.
3. **Congelar cambios** en el sistema actual (fuera de una jornada).
4. **Exportar los datos** del Cloud (string de conexión en *Project Settings
   → Database*, con la contraseña de la base):

   ```bash
   # Usuarios de login (conserva las contraseñas: se exportan ya cifradas)
   pg_dump "$CLOUD_DB_URL" --data-only \
     --table=auth.users --table=auth.identities > auth.sql

   # Datos del sistema
   pg_dump "$CLOUD_DB_URL" --data-only --schema=public > public.sql
   ```

5. **Importar** en el Supabase propio, con usuario administrador de Postgres
   (en self-hosted, `supabase_admin`) y los triggers desactivados durante la
   carga (si no, reescriben fechas de actualización y duplican filas
   automáticas):

   ```bash
   # disciplines y categories ya las sembró schema.sql: vaciarlas primero
   psql "$NEW_DB_URL" -c "truncate disciplines, categories cascade;"

   PGOPTIONS='-c session_replication_role=replica' \
     psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f auth.sql
   PGOPTIONS='-c session_replication_role=replica' \
     psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f public.sql
   ```

   Si la importación de `auth.sql` falla por columnas que no existen o
   sobran, es porque el Auth del Cloud y el del self-hosted son de versiones
   distintas: volver a exportar con `--column-inserts` (genera `INSERT` con
   nombres de columna) y quitar del archivo las columnas que el destino no
   tenga. Son pocos usuarios (solo administradores), así que también se
   pueden recrear a mano desde la pantalla *Usuarios* del panel.

6. **Reconstruir la imagen de la app** con la nueva
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y desplegarla
   con la nueva `SUPABASE_SERVICE_ROLE_KEY`.
7. **Verificar** con la lista de la sección 10.

Qué pasa con lo existente:

- **Contraseñas**: se conservan (van cifradas en `auth.users`).
- **Sesiones abiertas**: se pierden (cambia la clave de firma): cada admin
  inicia sesión de nuevo, una vez.
- **Links de juez y de acreditación**: siguen funcionando (los tokens están
  en los datos). Si cambia el dominio de la app, hay que recompartirlos.
- La contraseña de la base del Cloud se puede resetear después de migrar.

### 7C. Solo PostgreSQL propio (sin Supabase)

**No es viable sin reescribir partes del sistema.** Habría que reemplazar:
el login y la gestión de usuarios (Supabase Auth), todas las consultas (hoy
van por la API REST de Supabase con `supabase-js`), el tiempo real
(marcadores y relojes en vivo) y adaptar las reglas de seguridad de la base,
que dependen de `auth.uid()` y de los roles de Supabase. Tampoco alcanza con
apuntar el Supabase self-hosted a un PostgreSQL genérico administrado: el
stack espera su propia imagen de Postgres con extensiones y roles
específicos. Si la política exige "solo Postgres", conviene evaluarlo como un
proyecto aparte.

---

## 8. Cambios de base de datos (migraciones)

- `supabase/schema.sql`: estructura completa, para una **base nueva**.
- `supabase/migrations/NNNN_*.sql`: cambios incrementales, en orden, para una
  **base existente**. Cada release que traiga un archivo nuevo indica que hay
  que aplicarlo (SQL Editor o `psql`) **antes** de desplegar la imagen nueva.
- Cada migración se aplica **una sola vez**, en orden. Las más recientes
  (desde la 0014) están escritas para poder re-ejecutarse sin romper nada;
  las primeras no (crean tablas), así que llevar registro de cuál fue la
  última aplicada en cada ambiente.

---

## 9. Backups

- **Supabase Cloud Pro**: backups diarios automáticos (7 días).
- **Self-hosted**: responsabilidad propia. Mínimo, un volcado diario:

  ```bash
  pg_dump "$DB_URL" --format=custom --schema=public --schema=auth \
    -f "lrn-$(date +%F).dump"
  ```

  y guardar copias fuera del servidor. Probar la restauración al menos una
  vez antes de la primera jornada.

---

## 10. Verificación después de desplegar

1. `GET /api/health?deep=1` → `{"status":"ok","supabase":"ok"}`.
2. Iniciar sesión en `/admin` y abrir un evento.
3. Tocar un botón que guarde algo (ej. abrir/cerrar una inscripción): si
   falla con *"Invalid Server Actions request"*, ver sección 5.
4. Abrir el link de un juez en una tablet y la pantalla del evento
   (`/evento/<id>/pantalla`) en otra: iniciar un partido desde el juez y ver
   que el reloj arranca solo en la pantalla (tiempo real → Supabase WSS
   accesible).
5. Exportar el Excel de un evento.
6. Abrir el sitio desde un celular con datos móviles (acceso desde internet).

---

## 11. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Build falla en `npm ci` | Sin acceso al registry npm | `NPM_CONFIG_REGISTRY` con el espejo interno |
| Build falla: "faltan --build-arg" | Faltan las `NEXT_PUBLIC_*` | Pasarlas como `--build-arg` |
| El sitio abre pero "Faltan NEXT_PUBLIC_SUPABASE_URL..." | Imagen construida sin las variables | Reconstruir con los `--build-arg` |
| Botones del panel: "Invalid Server Actions request" | El proxy reescribe el Host | Preservar Host / `SERVER_ACTIONS_ALLOWED_ORIGINS` |
| Botones fallan al azar: "Failed to find Server Action" | Varias réplicas con builds distintos | Misma imagen en todas + `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` |
| Relojes y marcadores no se actualizan solos | Navegadores sin acceso WSS a Supabase | Habilitar WebSocket hacia la URL de Supabase |
| No se puede iniciar sesión | Navegador sin acceso a Supabase Auth | Misma causa: la URL de Supabase tiene que ser alcanzable desde el navegador |
| `/api/health?deep=1` → 503 | El contenedor no llega a Supabase | Salida HTTPS / DNS / proxy de salida |
| Juez/acreditación: "Link inválido" o error 500 | Falta `SUPABASE_SERVICE_ROLE_KEY` en runtime | Cargar el secreto |
