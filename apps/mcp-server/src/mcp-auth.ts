export const MCP_OAUTH_SCOPE = "mcp:access";
export const DEFAULT_API_BASE_URL = "http://localhost:8787";
export const DEFAULT_WEB_APP_URL = "http://localhost:3000";

type AuthMethod = "api-key" | "oauth" | "session";

export type McpAuthSuccess = {
  ok: true;
  method: AuthMethod;
  userId: string;
};

export type McpAuthFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type McpAuthResult = McpAuthSuccess | McpAuthFailure;

export type McpAuthInput = {
  apiKey?: string | null;
  authorization?: string | null;
  sessionUserId?: string | null;
};

type OAuthVerificationResult = {
  userId: string | null;
  scopes?: string[] | string | null;
};

type McpAuthDependencies = {
  verifyApiKey: (apiKey: string) => Promise<string | null>;
  verifyOAuthBearer: (
    bearerToken: string,
  ) => Promise<OAuthVerificationResult | null>;
};

type MetadataOptions = {
  appBaseUrl?: string;
  webAppUrl?: string;
};

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name: string;
};

export function normalizeOrigin(
  url: string | undefined,
  fallback: string,
): string {
  return (url?.trim() || fallback).replace(/\/+$/, "");
}

export function getMcpResourceUrl(appBaseUrl = process.env.APP_BASE_URL) {
  return `${normalizeOrigin(appBaseUrl, DEFAULT_API_BASE_URL)}/mcp`;
}

export function createProtectedResourceMetadata(
  options: MetadataOptions = {},
): ProtectedResourceMetadata {
  return {
    resource: getMcpResourceUrl(options.appBaseUrl),
    authorization_servers: [
      normalizeOrigin(options.webAppUrl, DEFAULT_WEB_APP_URL),
    ],
    scopes_supported: [MCP_OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "milkbridge MCP",
  };
}

export function createWwwAuthenticateHeader(
  appBaseUrl = process.env.APP_BASE_URL,
): string {
  const metadataUrl = `${normalizeOrigin(
    appBaseUrl,
    DEFAULT_API_BASE_URL,
  )}/.well-known/oauth-protected-resource/mcp`;
  return `Bearer resource_metadata="${metadataUrl}"`;
}

function bearerTokenFromAuthorization(
  authorization: string | null | undefined,
) {
  if (!authorization) return null;
  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function hasMcpScope(scopes: OAuthVerificationResult["scopes"]) {
  if (Array.isArray(scopes)) return scopes.includes(MCP_OAUTH_SCOPE);
  return scopes?.split(/\s+/).includes(MCP_OAUTH_SCOPE) ?? false;
}

export async function resolveMcpAuthenticatedUser(
  input: McpAuthInput,
  deps: McpAuthDependencies,
): Promise<McpAuthResult> {
  if (input.apiKey != null) {
    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      return { ok: false, status: 401, error: "Invalid API key" };
    }

    const userId = await deps.verifyApiKey(apiKey);
    if (userId) {
      return { ok: true, method: "api-key", userId };
    }
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (input.authorization != null) {
    const bearerToken = bearerTokenFromAuthorization(input.authorization);
    if (!bearerToken) {
      return { ok: false, status: 401, error: "Invalid OAuth bearer token" };
    }

    const verified = await deps.verifyOAuthBearer(bearerToken);
    if (!verified?.userId) {
      return { ok: false, status: 401, error: "Invalid OAuth bearer token" };
    }

    if (!hasMcpScope(verified.scopes)) {
      return { ok: false, status: 403, error: "Insufficient OAuth scope" };
    }

    return { ok: true, method: "oauth", userId: verified.userId };
  }

  if (input.sessionUserId) {
    return { ok: true, method: "session", userId: input.sessionUserId };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
