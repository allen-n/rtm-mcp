import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Users table
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("email_verified", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("name", "text")
    .addColumn("image", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
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
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("expires_at", "text", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text")
    .addColumn("ip_address", "text")
    .addColumn("user_agent", "text")
    .addForeignKeyConstraint(
      "sessions_user_fk",
      ["user_id"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // Accounts table (BetterAuth for OAuth)
  await db.schema
    .createTable("accounts")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("provider_account_id", "text", (col) => col.notNull())
    .addColumn("access_token", "text")
    .addColumn("refresh_token", "text")
    .addColumn("expires_at", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text")
    .addForeignKeyConstraint(
      "accounts_user_fk",
      ["user_id"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // RTM tokens
  await db.schema
    .createTable("rtm_tokens")
    .addColumn("user_id", "text", (col) => col.notNull().primaryKey())
    .addColumn("auth_token", "text", (col) => col.notNull())
    .addColumn("perms", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("username", "text")
    .addColumn("fullname", "text")
    .addColumn("updated_at", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "rtm_tokens_user_fk",
      ["user_id"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  // Timeline management - session-based with expiry
  await db.schema
    .createTable("rtm_timelines")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("timeline", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("expires_at", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "rtm_timelines_user_fk",
      ["user_id"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("rtm_timelines_user_idx")
    .on("rtm_timelines")
    .column("user_id")
    .execute();

  // Webhook subscriptions
  await db.schema
    .createTable("webhook_subs")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("subscription_id", "text", (col) => col.notNull())
    .addColumn("topics", "text", (col) => col.notNull())
    .addColumn("filter", "text")
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("lease_seconds", "integer")
    .addColumn("expires_at", "text")
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .addForeignKeyConstraint(
      "webhook_subs_user_fk",
      ["user_id"],
      "users",
      ["id"],
      (fk) => fk.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("webhook_subs_user_idx")
    .on("webhook_subs")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("webhook_subs").execute();
  await db.schema.dropTable("rtm_timelines").execute();
  await db.schema.dropTable("rtm_tokens").execute();
  await db.schema.dropTable("accounts").execute();
  await db.schema.dropTable("sessions").execute();
  await db.schema.dropTable("users").execute();
}
