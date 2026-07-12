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
# Prefer venv python so `spawn("python3")` finds geopandas
ENV PATH="/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ENV PNPM_HOME="/pnpm"
ENV PATH="/opt/venv/bin:$PNPM_HOME:$PATH"

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

# pnpm needs a reinstall after full source copy (workspace + symlink integrity)
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

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Needed for GIS import (spawn python3 .../python/process_mpk.py)
COPY --from=builder /app/python ./python
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations

RUN mkdir -p /app/uploads \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "server.js"]
