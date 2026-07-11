import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as {
  __dbEnvLoaded?: boolean;
  __pgPool?: Pool;
};

if (!globalForDb.__dbEnvLoaded) {
  config({ path: ".env.local" });
  config();
  globalForDb.__dbEnvLoaded = true;
}

const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool;
}

export const db = drizzle(pool, { schema });

export { pool };

export type Database = typeof db;
