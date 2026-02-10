import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";
import type { DB } from "./schema";

types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => new Date(val));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => new Date(val));

const resolveBaseDir = () => {
  if (typeof __dirname === "string") return __dirname;
  if (typeof import.meta !== "undefined" && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  return process.cwd();
};

const baseDir = resolveBaseDir();

function findEnvPath(): string | undefined {
  let dir = baseDir;
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
