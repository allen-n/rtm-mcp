import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Migrator, FileMigrationProvider, sql } from "kysely";
import { db } from "./kysely";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute path
const migrationFolder = path.resolve(__dirname, "migrations");

export const getDevCommand = () => {
  if (process.argv.length < 3) {
    return { command: null, otherArgs: [] };
  }
  const command = process.argv[2] ?? null;
  const commandPath = process.argv[1] ?? null;
  const otherArgs = process.argv.slice(3);
  if (!command || !commandPath) {
    return { command: null, otherArgs };
  }

  return { command, otherArgs };
};

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
});

async function waitForDatabase(retries = 10, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await sql`select 1`.execute(db);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(
        `Database not ready (attempt ${attempt}/${retries}), retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

const { command, otherArgs } = getDevCommand();
const validCommands = [
  null,
  "list",
  "up",
  "down",
  "latest",
  "to",
  "-h",
  "--help",
  "help",
];

async function main() {
  if (!validCommands.includes(command)) {
    console.error(
      `Got: ${command}, which is not a valid command. Valid commands are:\nlist, up, down, latest, [target_migration_name], -h, --help, help, or no command to run all migrations to latest`
    );
    return;
  }

  function getHelpMessage(): string {
    return `
  Available commands:
    list   - List all migrations
    up     - Migrate up
    down   - Migrate down
    latest - Migrate to the latest version, complete all pending migrations (can also be run with no command)
    to [target_migration_name] - Migrate to a specific migration
    -h, --help, help - Display this help message
    `;
  }

  if (command === "-h" || command === "--help" || command === "help") {
    console.log(getHelpMessage());
    return;
  }

  await waitForDatabase();
  async function runCommand() {
    if (command === "list") {
      console.log("listing migrations");
      const list = await migrator.getMigrations();
      console.log(list);
      return { results: [] };
    }

    if (command === "up") {
      console.log("migrating up");
      return await migrator.migrateUp();
    }

    if (command === "down") {
      console.log("migrating down");
      return await migrator.migrateDown();
    }

    if (command === "to") {
      const targetMigration = otherArgs[0];
      console.log("migrating to", targetMigration);
      return await migrator.migrateTo(targetMigration);
    }
    console.log("migrating to latest");
    return await migrator.migrateToLatest();
  }
  const { error, results } = await runCommand();
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
