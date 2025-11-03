import { betterAuth } from "better-auth";
import { db } from "@db/kysely";
import type { Session, SessionUser } from "./types";

// Configure authentication with OAuth and email/password support
export const auth = betterAuth({
  database: db, // Kysely instance directly (BetterAuth auto-detects)

  appName: process.env.APP_NAME || "MCP-RTM",

  secret: process.env.BETTER_AUTH_SECRET!,

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8787",

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

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // CORS for web app
  trustedOrigins: [
    "http://localhost:3000",
    process.env.WEB_APP_URL || "",
  ].filter(Boolean),
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
