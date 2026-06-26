import { pool } from "@db/kysely"; // If using better auth cli, use the absolute path import for the module
// import {pool} from "<path-to>/rtm-mcp/packages/db/src/kysely"
import { apiKey } from "@better-auth/api-key";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import type { Session, SessionUser } from "./types";

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

const normalizeOrigin = (url: string | undefined, fallback: string) =>
  (url?.trim() || fallback).replace(/\/+$/, "");

const appBaseUrl = normalizeOrigin(
  process.env.APP_BASE_URL,
  "http://localhost:8787",
);
const webAppUrl = normalizeOrigin(
  process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL,
  "http://localhost:3000",
);
const oauthScopes = ["mcp:access", "offline_access"];

// Configure authentication with OAuth and email/password support
export const auth = betterAuth({
  database: pool, // postgres pool directly (BetterAuth auto-detects)

  appName: process.env.APP_NAME || "MCP-RTM",

  secret: betterAuthSecret,

  baseURL: normalizeOrigin(process.env.BETTER_AUTH_URL, webAppUrl),

  // Map BetterAuth's camelCase field names to our snake_case database columns
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes - reduces database calls and improves session reliability
    },
  },

  account: {
    fields: {
      userId: "user_id",
      accountId: "provider_account_id",
      providerId: "provider",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      // Note: idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password
      // are already camelCase in the schema, so no mapping needed
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  // Enable email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // For dev - can enable later
  },

  // OAuth providers configuration (currently disabled, can be enabled by uncommenting)
  socialProviders: {
    // Uncomment when OAuth providers are configured
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // },
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // },
  },

  // CORS for web app
  trustedOrigins: ["http://localhost:3000", webAppUrl].filter(Boolean),

  // Cookie configuration
  // Auth requests are proxied through Next.js (same-origin), so lax is sufficient
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Prevent XSS attacks
    },
  },

  // API Key plugin for MCP server authentication
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/oauth/consent",
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      grantTypes: ["authorization_code", "refresh_token"],
      prefix: {
        opaqueAccessToken: "mb_at_",
        refreshToken: "mb_rt_",
        clientSecret: "mb_cs_",
      },
      scopes: oauthScopes,
      validAudiences: [`${appBaseUrl}/mcp`],
      clientRegistrationDefaultScopes: ["mcp:access"],
      clientRegistrationAllowedScopes: ["offline_access"],
    }),
    apiKey({
      // Header to check for API key
      apiKeyHeaders: ["x-api-key"],

      schema: {
        apikey: {
          fields: {
            referenceId: "userId",
            configId: "config_id",
          },
        },
      },

      // Rate limiting per API key
      rateLimit: {
        enabled: true,
        maxRequests: 1000, // Max requests
        timeWindow: 60 * 60, // Per hour
      },
    }),
  ],
});

// Helper to extract session from request
export async function getSession(req: Request): Promise<Session> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
}

// Helper to require authenticated user (throws if not logged in)
export function requireUser(session: Session): SessionUser {
  if (!session?.user) {
    throw new Error("Unauthorized: No active session");
  }
  return session.user;
}

export type { Session, SessionUser };
