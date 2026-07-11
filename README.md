# Land Management System

Bangladesh land records platform built with Next.js App Router, Drizzle ORM, PostgreSQL + PostGIS, Cloudinary, Cloudflare R2, and Resend.

## Stack

- **Framework:** Next.js 16 (App Router)
- **ORM:** Drizzle ORM + PostgreSQL 16 + PostGIS
- **Auth:** NextAuth (credentials + JWT) with RBAC
- **Public files:** Cloudinary (maps, photos)
- **Sensitive files:** Cloudflare R2 (signed URLs + audit log)
- **Email:** Resend

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, and `ENCRYPTION_KEY` at minimum.

### 3. Database setup

Ensure PostgreSQL has PostGIS available, then:

```bash
# Apply PostGIS extension first
psql $DATABASE_URL -f lib/db/migrations/0000_postgis_extension.sql

# Push schema (or use db:generate + db:migrate)
pnpm db:push

# Seed sample geography, parcel, and staff users
pnpm db:seed
```

### 4. Run dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed users

| Email | Password | Role |
|---|---|---|
| admin@land.gov.bd | admin123 | super_admin |
| officer@land.gov.bd | admin123 | land_officer |
| approver@land.gov.bd | admin123 | approver |
| verifier@land.gov.bd | admin123 | field_verifier |

## Project structure

```
app/
  (public)/search/          Public parcel search
  (public)/parcel/[id]/     Public read-only parcel view
  (dashboard)/dashboard/    Staff dashboard (parcels, mutations, verification, reports)
  api/                      REST endpoints
lib/
  db/schema/                Drizzle schema (geography, parcels, ownership, legal, …)
  storage/                  Cloudinary + R2 integrations
  auth/                     NextAuth + RBAC
  workflows/                Mutation & verification state machines
  jobs/                     Report generation pipeline
```

## Key design rules

1. **Two storage tiers** — Cloudinary for maps/photos; R2 for deeds, khatians, court docs
2. **PostGIS geometry** — plot/mouza boundaries as first-class spatial data
3. **Audit log** — every write to ownership, legal, and mutation tables
4. **Maker-checker** — officers apply mutations; approvers finalize
5. **Signed URLs** — confidential R2 documents never use permanent public links

## API routes

| Route | Purpose |
|---|---|
| `GET /api/parcels` | Search parcels |
| `GET /api/parcels/[id]` | Full parcel detail |
| `POST /api/documents/sign-url` | Issue signed download URL |
| `POST /api/reports/generate` | Enqueue property report |
| `POST /api/mutations/transition` | Mutation state machine |
| `POST /api/verification/transition` | Ownership verification workflow |
| `GET /api/geography` | Cascading location picker |

## Spatial indexes

After migrations, add GiST indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_parcels_boundary ON land_parcels USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_mouzas_boundary ON mouzas USING GIST (boundary);
```
