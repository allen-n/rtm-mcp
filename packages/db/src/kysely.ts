import fs from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";
import type { DB } from "./schema";

types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => new Date(val));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => new Date(val));

// Load .env file only in development (when DATABASE_URL is not set)
// This avoids bundling issues with dotenv's CJS dynamic requires
if (!process.env.DATABASE_URL) {
  // Dynamic import to avoid bundling issues
  const loadEnvFile = async () => {
    try {
      const { config: loadEnv } = await import("dotenv");
      // Search for .env file starting from cwd
      let dir = process.cwd();
      const { root } = path.parse(dir);
      while (dir && dir !== root) {
        const candidate = path.join(dir, ".env");
        if (fs.existsSync(candidate)) {
          loadEnv({ path: candidate });
          return;
        }
        dir = path.dirname(dir);
      }
    } catch {
      // dotenv not available, skip
      console.warn(
        "dotenv not found, skipping .env loading. Make sure to set environment variables in production.",
      );
    }
  };
  // Note: This is sync-ish for backwards compat, but env loading is best-effort
  loadEnvFile();
}

const buildConnectionString = () => {
  const url = new URL("postgres://localhost");
  url.username = process.env.POSTGRES_USER ?? "postgres";
  url.password = process.env.POSTGRES_PASSWORD ?? "postgres";
  url.hostname = process.env.POSTGRES_HOST ?? "localhost";
  url.port = process.env.POSTGRES_PORT ?? "5432";
  url.pathname = `/${process.env.POSTGRES_DB ?? "postgres"}`;
  return url.toString();
};

const connectionString = process.env.DATABASE_URL ?? buildConnectionString();

const ssl =
  process.env.POSTGRES_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({
  connectionString,
  ssl,
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export type { DB } from "./schema";
export { pool };
