// Client-side authentication utilities for web app
import { apiKeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { SessionUser } from "./types";

// Create the auth client for React components
// Requests go to same-origin /api/auth/* and are proxied to the API server
// via Next.js rewrites (see apps/web/next.config.mjs)
export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
  },
  plugins: [apiKeyClient()],
});

// Re-export useful types
export type { SessionUser };

// Legacy helper functions (can be replaced with authClient hooks)
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.user || null;
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    const res = await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Sign out failed: ${res.status}`);
    }
  } catch (error) {
    console.error("Failed to sign out:", error);
    throw error instanceof Error ? error : new Error("Failed to sign out");
  }
}
