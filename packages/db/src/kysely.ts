import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "./schema";

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
  ssl
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool
  })
});

export type { DB } from "./schema";
