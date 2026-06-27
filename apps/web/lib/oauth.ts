// Shared helpers for the BetterAuth OAuth provider browser flows.

/**
 * BetterAuth's OAuth actions (`oauth2.continue`, `oauth2.consent`) return the
 * post-authorization redirect target under either `url` or `redirect_uri`
 * depending on the action. Normalize both into a single string (or null).
 */
export function getOAuthRedirectUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { url?: unknown; redirect_uri?: unknown };
  if (typeof record.url === "string") return record.url;
  if (typeof record.redirect_uri === "string") return record.redirect_uri;
  return null;
}
