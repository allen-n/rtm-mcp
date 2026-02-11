import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";
import type { DB } from "./schema.js";

types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => new Date(val));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => new Date(val));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Search for .env file starting from a directory and walking up to the root.
 */
function findEnvFromDir(startDir: string): string | undefined {
  let dir = startDir;
  const { root } = path.parse(dir);
  while (dir && dir !== root) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * Find .env file by checking both process.cwd() (app root) and __dirname (package location).
 * This ensures .env is found whether running from the consuming app or from the package directly.
 */
function findEnvPath(): string | undefined {
  // First check from the current working directory (where the app is run from)
  const fromCwd = findEnvFromDir(process.cwd());
  if (fromCwd) return fromCwd;

  // Fallback to searching from this file's location (for direct package usage)
  return findEnvFromDir(__dirname);
}

if (!process.env.DATABASE_URL) {
  const envPath = findEnvPath();
  if (envPath) {
    loadEnv({ path: envPath });
  }
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

// Note: rejectUnauthorized is set to false when POSTGRES_SSL=true.
// This is required for many cloud database providers (Railway, Render, etc.)
// that use self-signed certificates. For production with stricter security
// requirements, configure a proper CA certificate instead.
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

export type { DB } from "./schema.js";
export { pool };
