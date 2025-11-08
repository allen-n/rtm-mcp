import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Users table
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull().unique())
    // BetterAuth expects camelCase column names when using adapters that map directly
    .addColumn("emailVerified", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("name", "text")
    .addColumn("image", "text")
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("users_email_idx")
    .on("users")
    .column("email")
    .execute();

  // Sessions table (BetterAuth)
  await db.schema
    .createTable("sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("expiresAt", "text", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull())
    .addColumn("createdAt", "text", (col) => col.notNull())
    // BetterAuth may store/update these optional fields; include them for compatibility
    .addColumn("updatedAt", "text")
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addForeignKeyConstraint(
      "sessions_user_fk",
      ["userId"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // Accounts table (BetterAuth for OAuth)
  await db.schema
    .createTable("accounts")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("providerAccountId", "text", (col) => col.notNull())
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("expiresAt", "text")
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text")
    .addForeignKeyConstraint(
      "accounts_user_fk",
      ["userId"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // RTM tokens
  await db.schema
    .createTable("rtmTokens")
    .addColumn("userId", "text", (col) => col.notNull().primaryKey())
    .addColumn("authToken", "text", (col) => col.notNull())
    .addColumn("perms", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("username", "text")
    .addColumn("fullname", "text")
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "rtmTokens_user_fk",
      ["userId"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // Timeline management - session-based with expiry
  await db.schema
    .createTable("rtmTimelines")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("timeline", "text", (col) => col.notNull())
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("expiresAt", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "rtmTimelines_user_fk",
      ["userId"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("rtmTimelines_user_idx")
    .on("rtmTimelines")
    .column("userId")
    .execute();

  // Webhook subscriptions
  await db.schema
    .createTable("webhookSubs")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("subscriptionId", "text", (col) => col.notNull())
    .addColumn("topics", "text", (col) => col.notNull())
    .addColumn("filter", "text")
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("leaseSeconds", "integer")
    .addColumn("expiresAt", "text")
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "webhookSubs_user_fk",
      ["userId"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("webhookSubs_user_idx")
    .on("webhookSubs")
    .column("userId")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("webhookSubs").execute();
  await db.schema.dropTable("rtmTimelines").execute();
  await db.schema.dropTable("rtmTokens").execute();
  await db.schema.dropTable("accounts").execute();
  await db.schema.dropTable("sessions").execute();
  await db.schema.dropTable("users").execute();
}
