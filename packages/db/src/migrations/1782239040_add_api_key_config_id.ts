import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("apikey")
    .addColumn("config_id", "text", (col) => col.notNull().defaultTo("default"))
    .execute();

  await db.schema
    .createIndex("api_key_config_idx")
    .on("apikey")
    .column("config_id")
    .execute();

  await db.schema
    .createIndex("api_key_key_idx")
    .on("apikey")
    .column("key")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("api_key_key_idx").execute();
  await db.schema.dropIndex("api_key_config_idx").execute();
  await db.schema.alterTable("apikey").dropColumn("config_id").execute();
}
