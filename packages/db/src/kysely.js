import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
const dbPath = process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.replace("file:", "")
    : "./data/dev.db";
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true });
export const db = new Kysely({
    dialect: new SqliteDialect({
        database: new Database(dbPath)
    })
});
