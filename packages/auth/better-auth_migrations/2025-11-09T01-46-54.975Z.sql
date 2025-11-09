create table "user" (
    "id" text not null primary key,
    "name" text not null,
    "email" text not null unique,
    "email_verified" boolean not null,
    "image" text,
    "created_at" timestamptz default CURRENT_TIMESTAMP not null,
    "updated_at" timestamptz default CURRENT_TIMESTAMP not null
);
create table "session" (
    "id" text not null primary key,
    "expires_at" timestamptz not null,
    "token" text not null unique,
    "created_at" timestamptz default CURRENT_TIMESTAMP not null,
    "updated_at" timestamptz not null,
    "ip_address" text,
    "user_agent" text,
    "user_id" text not null references "user" ("id") on delete cascade
);
create table "account" (
    "id" text not null primary key,
    "provider_account_id" text not null,
    "provider" text not null,
    "user_id" text not null references "user" ("id") on delete cascade,
    "access_token" text,
    "refresh_token" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamptz,
    "refreshTokenExpiresAt" timestamptz,
    "scope" text,
    "password" text,
    "created_at" timestamptz default CURRENT_TIMESTAMP not null,
    "updated_at" timestamptz not null
);
create table "verification" (
    "id" text not null primary key,
    "identifier" text not null,
    "value" text not null,
    "expiresAt" timestamptz not null,
    "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
    "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);