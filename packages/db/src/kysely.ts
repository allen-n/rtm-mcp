import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { DB } from "./schema";

const dbPath = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL.replace("file:", "")
  : "./data/dev.db";

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: new Database(dbPath)
  })
});

export type { DB } from "./schema";
