<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Database schema changes

**Always use Drizzle generate + migrate. Never hand-write SQL migration files.**

1. Edit schema in `lib/db/schema/*.ts`
2. Run:

```bash
pnpm db:sync
```

Or explicitly:

```bash
pnpm db:generate && pnpm db:migrate
```

- Do **not** use `db:push` for schema changes in this project (it skips migration history and causes `db:generate` to recreate the same changes).
- After changing schema, `db:generate` should report either a new migration file or "No schema changes". If it keeps generating the same migration, the snapshot/journal is out of sync — fix that before applying again.
