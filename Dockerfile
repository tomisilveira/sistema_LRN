# syntax=docker/dockerfile:1.7
# ==========================================================================
# Liga Robótica Neuquina — imagen de producción (Next.js standalone).
#
# Build (las NEXT_PUBLIC_* se "congelan" en el JavaScript del navegador
# durante el build: una imagen por ambiente):
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#     --build-arg SITE_URL=https://liga.ejemplo.gob.ar \
#     -t sistema-lrn:1.0.0 .
#
# Run (SUPABASE_SERVICE_ROLE_KEY es secreta: SOLO en runtime, nunca en build):
#
#   docker run -p 3000:3000 \
#     -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
#     -e SITE_URL=https://liga.ejemplo.gob.ar \
#     sistema-lrn:1.0.0
#
# Guía completa (variables, proxy, réplicas, base de datos): docs/DEPLOY.md
# ==========================================================================

ARG NODE_IMAGE=node:24-alpine

# ---- base -----------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: node_modules completos (con devDependencies, hacen falta para
# compilar: TypeScript, Tailwind) ----------------------------------------------
FROM base AS deps
# Registry npm interno (Nexus/Artifactory) si la nube no tiene salida a
# internet. Vacío = registry público.
ARG NPM_CONFIG_REGISTRY
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- builder ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Públicas (quedan dentro del bundle del navegador; no son secretas: la
# anon key está pensada para ser pública y la protege la RLS de la base).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
# URL pública del sistema (para las imágenes de vista previa al compartir).
ARG SITE_URL
# Opcionales — ver docs/DEPLOY.md:
ARG SERVER_ACTIONS_ALLOWED_ORIGINS
ARG DEPLOYMENT_ID
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    SITE_URL=${SITE_URL} \
    SERVER_ACTIONS_ALLOWED_ORIGINS=${SERVER_ACTIONS_ALLOWED_ORIGINS} \
    DEPLOYMENT_ID=${DEPLOYMENT_ID} \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}

# Falla temprano y claro si faltan las dos obligatorias (si no, la imagen
# compila igual pero el sitio no anda al abrirlo).
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    || (echo "ERROR: faltan --build-arg NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY" && exit 1)

RUN npm run build

# ---- runner: solo lo necesario para correr ------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios (no root).
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Liveness: el proceso responde. (Readiness con Supabase: /api/health?deep=1)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
