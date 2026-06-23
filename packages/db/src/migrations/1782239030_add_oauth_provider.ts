import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("oauthClient")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("clientId", "text", (col) => col.notNull().unique())
    .addColumn("clientSecret", "text")
    .addColumn("disabled", "boolean", (col) => col.defaultTo(false))
    .addColumn("skipConsent", "boolean")
    .addColumn("enableEndSession", "boolean")
    .addColumn("subjectType", "text")
    .addColumn("scopes", sql`text[]`)
    .addColumn("userId", "text", (col) =>
      col.references("user.id").onDelete("cascade"),
    )
    .addColumn("referenceId", "text")
    .addColumn("createdAt", "timestamptz")
    .addColumn("updatedAt", "timestamptz")
    .addColumn("name", "text")
    .addColumn("uri", "text")
    .addColumn("icon", "text")
    .addColumn("contacts", sql`text[]`)
    .addColumn("tos", "text")
    .addColumn("policy", "text")
    .addColumn("softwareId", "text")
    .addColumn("softwareVersion", "text")
    .addColumn("softwareStatement", "text")
    .addColumn("redirectUris", sql`text[]`, (col) => col.notNull())
    .addColumn("postLogoutRedirectUris", sql`text[]`)
    .addColumn("tokenEndpointAuthMethod", "text")
    .addColumn("grantTypes", sql`text[]`)
    .addColumn("responseTypes", sql`text[]`)
    .addColumn("public", "boolean")
    .addColumn("type", "text")
    .addColumn("requirePKCE", "boolean")
    .addColumn("metadata", "jsonb")
    .execute();

  await db.schema
    .createIndex("oauth_client_user_idx")
    .on("oauthClient")
    .column("userId")
    .execute();

  await db.schema
    .createTable("oauthRefreshToken")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("clientId", "text", (col) =>
      col.notNull().references("oauthClient.clientId").onDelete("cascade"),
    )
    .addColumn("sessionId", "text", (col) =>
      col.references("session.id").onDelete("set null"),
    )
    .addColumn("userId", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("referenceId", "text")
    .addColumn("expiresAt", "timestamptz", (col) => col.notNull())
    .addColumn("createdAt", "timestamptz", (col) => col.notNull())
    .addColumn("revoked", "timestamptz")
    .addColumn("authTime", "timestamptz")
    .addColumn("scopes", sql`text[]`, (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("oauth_refresh_token_client_idx")
    .on("oauthRefreshToken")
    .column("clientId")
    .execute();
  await db.schema
    .createIndex("oauth_refresh_token_session_idx")
    .on("oauthRefreshToken")
    .column("sessionId")
    .execute();
  await db.schema
    .createIndex("oauth_refresh_token_user_idx")
    .on("oauthRefreshToken")
    .column("userId")
    .execute();

  await db.schema
    .createTable("oauthAccessToken")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("token", "text", (col) => col.unique())
    .addColumn("clientId", "text", (col) =>
      col.notNull().references("oauthClient.clientId").onDelete("cascade"),
    )
    .addColumn("sessionId", "text", (col) =>
      col.references("session.id").onDelete("set null"),
    )
    .addColumn("userId", "text", (col) =>
      col.references("user.id").onDelete("cascade"),
    )
    .addColumn("referenceId", "text")
    .addColumn("refreshId", "text", (col) =>
      col.references("oauthRefreshToken.id").onDelete("cascade"),
    )
    .addColumn("expiresAt", "timestamptz", (col) => col.notNull())
    .addColumn("createdAt", "timestamptz", (col) => col.notNull())
    .addColumn("scopes", sql`text[]`, (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("oauth_access_token_client_idx")
    .on("oauthAccessToken")
    .column("clientId")
    .execute();
  await db.schema
    .createIndex("oauth_access_token_session_idx")
    .on("oauthAccessToken")
    .column("sessionId")
    .execute();
  await db.schema
    .createIndex("oauth_access_token_user_idx")
    .on("oauthAccessToken")
    .column("userId")
    .execute();
  await db.schema
    .createIndex("oauth_access_token_refresh_idx")
    .on("oauthAccessToken")
    .column("refreshId")
    .execute();

  await db.schema
    .createTable("oauthConsent")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("clientId", "text", (col) =>
      col.notNull().references("oauthClient.clientId").onDelete("cascade"),
    )
    .addColumn("userId", "text", (col) =>
      col.references("user.id").onDelete("cascade"),
    )
    .addColumn("referenceId", "text")
    .addColumn("scopes", sql`text[]`, (col) => col.notNull())
    .addColumn("createdAt", "timestamptz", (col) => col.notNull())
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("oauth_consent_client_idx")
    .on("oauthConsent")
    .column("clientId")
    .execute();
  await db.schema
    .createIndex("oauth_consent_user_idx")
    .on("oauthConsent")
    .column("userId")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("oauthConsent").execute();
  await db.schema.dropTable("oauthAccessToken").execute();
  await db.schema.dropTable("oauthRefreshToken").execute();
  await db.schema.dropTable("oauthClient").execute();
}
