import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Migrator, FileMigrationProvider } from "kysely";
import { db } from "./kysely.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute path
const migrationFolder = path.resolve(__dirname, "migrations");

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
});

async function main() {
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((r) => {
    if (r.status === "Success") {
      console.log(`✅ Migration ${r.migrationName} executed successfully`);
    } else if (r.status === "Error") {
      console.error(`❌ Migration ${r.migrationName} failed`);
    }
  });

  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  console.log("✅ All migrations completed successfully");
  await db.destroy();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
