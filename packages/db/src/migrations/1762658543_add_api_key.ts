import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // API Key table (BetterAuth API Key plugin)
  await db.schema
    .createTable("apikey")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("name", "text")
    .addColumn("start", "text")
    .addColumn("prefix", "text")
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("userId", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade")
    )
    .addColumn("refillInterval", "integer")
    .addColumn("refillAmount", "integer")
    .addColumn("lastRefillAt", "timestamptz")
    .addColumn("enabled", "boolean")
    .addColumn("rateLimitEnabled", "boolean")
    .addColumn("rateLimitTimeWindow", "integer")
    .addColumn("rateLimitMax", "integer")
    .addColumn("requestCount", "integer")
    .addColumn("remaining", "integer")
    .addColumn("lastRequest", "timestamptz")
    .addColumn("expiresAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (col) => col.notNull())
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull())
    .addColumn("permissions", "text")
    .addColumn("metadata", "text")
    .execute();

  // Index for faster user lookups
  await db.schema
    .createIndex("api_key_user_idx")
    .on("apikey")
    .column("userId")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("apikey").execute();
}
