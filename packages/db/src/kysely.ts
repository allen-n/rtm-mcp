import fs from "node:fs";
import path from "node:path";
import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import type { DB } from "./schema";

const rawUrl = process.env.DATABASE_URL;
const dbPath = (() => {
  if (!rawUrl) return "./data/dev.db";
  if (rawUrl.startsWith("file:")) {
    return rawUrl.replace(/^file:/, "");
  }
  if (rawUrl.startsWith("sqlite://")) {
    return rawUrl.replace(/^sqlite:\/\//, "");
  }
  return rawUrl;
})();

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: new Database(dbPath)
  })
});

export type { DB } from "./schema";
