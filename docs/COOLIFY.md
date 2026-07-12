# Coolify (Hostinger) — app service settings for land-management-system
#
# Build Pack: Dockerfile  (switch away from Nixpacks)
# Ports Exposes: 3000
#
# Do NOT put db:migrate in the Build Command when using Dockerfile.
# Migrations run once after first deploy (Coolify terminal or laptop).
#
# Persistent Storage:
#   Name: lms-uploads
#   Destination Path: /app/uploads
#
# Required env (Environment Variables tab):
#   DATABASE_URL
#   NEXTAUTH_URL
#   NEXTAUTH_SECRET
#   ENCRYPTION_KEY
#   CLOUDINARY_* / R2_* / NEXT_PUBLIC_MAPTILER_KEY / NEXT_PUBLIC_APP_URL
#
# NEXT_PUBLIC_* are baked in at Docker build time. Set them before rebuild
# (Coolify usually passes env vars as build args automatically).
#
# After deploy, migrate then seed from Coolify app Terminal:
#   pnpm db:migrate
#   ./node_modules/.bin/tsx lib/db/seed.ts
#   # or:
#   pnpm db:seed
#
# NEXTAUTH_URL example for Coolify sslip domain:
#   https://zgcajcn2c7xvrihm6dy2u286.193.203.163.46.sslip.io
