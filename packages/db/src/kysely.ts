import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";
import type { DB } from "./schema";

types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => new Date(val));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => new Date(val));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate the nearest `.env` file by walking upward from this file's directory.
 *
 * Stops searching when the filesystem root is reached.
 *
 * @returns The absolute path to the first `.env` file found, or `undefined` if none exists.
 */
function findEnvPath(): string | undefined {
  let dir = __dirname;
  const { root } = path.parse(dir);
  while (dir && dir !== root) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return undefined;
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