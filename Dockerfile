# syntax=docker/dockerfile:1

# ---- Base: Node 20 + Python GIS system libs ----
FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    g++ \
    make \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONUNBUFFERED=1
ENV PNPM_HOME="/pnpm"
# Prefer venv python so `spawn("python3")` finds geopandas
ENV PATH="/opt/venv/bin:$PNPM_HOME:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ---- Dependencies + Python venv ----
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY python/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

# ---- Build Next.js ----
FROM base AS builder

COPY --from=deps /opt/venv /opt/venv
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

COPY . .

RUN pnpm install --frozen-lockfile

# Placeholders only for build; Coolify injects real values at runtime
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-time-secret-placeholder"
ENV ENCRYPTION_KEY="build-time-encryption-key-placeholder"

RUN pnpm run build

# ---- Production runner ----
FROM base AS runner

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=deps /opt/venv /opt/venv

# Next.js standalone app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Full deps so Coolify terminal can run seed (tsx + drizzle + pg, etc.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Source needed for db:seed / GIS processing
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/python ./python
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

RUN mkdir -p /app/uploads \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "server.js"]
