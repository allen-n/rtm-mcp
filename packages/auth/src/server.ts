import { pool } from "@db/kysely"; // If using better auth cli, use the absolute path import for the module
import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";
import type { Session, SessionUser } from "./types";

// Configure authentication with OAuth and email/password support
export const auth = betterAuth({
  database: pool, // postgres pool directly (BetterAuth auto-detects)

  appName: process.env.APP_NAME || "MCP-RTM",

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env.BETTER_AUTH_SECRET!,

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8787",

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
  trustedOrigins: [
    "http://localhost:3000",
    process.env.WEB_APP_URL || "",
  ].filter(Boolean),

  // Advanced cookie configuration for cross-origin support
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none", // Required for cross-origin cookies between localhost:3000 and localhost:8787
      secure: true, // Required with sameSite=none (browsers allow secure cookies on localhost)
      httpOnly: true, // Prevent XSS attacks
    },
  },

  // API Key plugin for MCP server authentication
  plugins: [
    apiKey({
      // Header to check for API key
      apiKeyHeaders: ["x-api-key"],

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
