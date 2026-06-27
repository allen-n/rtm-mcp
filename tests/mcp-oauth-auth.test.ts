import { describe, expect, it, vi } from "vitest";
import {
  MCP_OAUTH_SCOPE,
  createProtectedResourceMetadata,
  createWwwAuthenticateHeader,
  resolveMcpAuthenticatedUser,
} from "../apps/mcp-server/src/mcp-auth";

describe("MCP OAuth metadata", () => {
  it("builds protected resource metadata for the public MCP endpoint", () => {
    const metadata = createProtectedResourceMetadata({
      appBaseUrl: "https://api.milkbridge.dev/",
      webAppUrl: "https://milkbridge.dev/",
    });

    expect(metadata).toMatchObject({
      resource: "https://api.milkbridge.dev/mcp",
      authorization_servers: ["https://milkbridge.dev"],
      scopes_supported: [MCP_OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "milkbridge MCP",
    });
  });

  it("points WWW-Authenticate at the protected resource metadata URL", () => {
    expect(createWwwAuthenticateHeader("https://api.milkbridge.dev/")).toBe(
      'Bearer resource_metadata="https://api.milkbridge.dev/.well-known/oauth-protected-resource/mcp"',
    );
  });
});

describe("resolveMcpAuthenticatedUser", () => {
  it("uses a valid API key before bearer or browser session auth", async () => {
    const verifyApiKey = vi.fn().mockResolvedValue("api-user");
    const verifyOAuthBearer = vi.fn().mockResolvedValue({
      userId: "oauth-user",
      scopes: [MCP_OAUTH_SCOPE],
    });

    await expect(
      resolveMcpAuthenticatedUser(
        {
          apiKey: "valid-api-key",
          authorization: "Bearer valid-token",
          sessionUserId: "session-user",
        },
        { verifyApiKey, verifyOAuthBearer },
      ),
    ).resolves.toEqual({ ok: true, method: "api-key", userId: "api-user" });

    expect(verifyOAuthBearer).not.toHaveBeenCalled();
  });

  it("rejects an invalid explicit API key without falling back", async () => {
    const result = await resolveMcpAuthenticatedUser(
      {
        apiKey: "bad-api-key",
        authorization: "Bearer valid-token",
        sessionUserId: "session-user",
      },
      {
        verifyApiKey: vi.fn().mockResolvedValue(null),
        verifyOAuthBearer: vi.fn().mockResolvedValue({
          userId: "oauth-user",
          scopes: [MCP_OAUTH_SCOPE],
        }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid API key",
    });
  });

  it("rejects an empty explicit API key without falling back", async () => {
    const verifyOAuthBearer = vi.fn().mockResolvedValue({
      userId: "oauth-user",
      scopes: [MCP_OAUTH_SCOPE],
    });

    const result = await resolveMcpAuthenticatedUser(
      {
        apiKey: "   ",
        authorization: "Bearer valid-token",
        sessionUserId: "session-user",
      },
      {
        verifyApiKey: vi.fn(),
        verifyOAuthBearer,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid API key",
    });
    expect(verifyOAuthBearer).not.toHaveBeenCalled();
  });

  it("accepts a bearer token with the MCP scope", async () => {
    await expect(
      resolveMcpAuthenticatedUser(
        { authorization: "Bearer valid-token" },
        {
          verifyApiKey: vi.fn(),
          verifyOAuthBearer: vi.fn().mockResolvedValue({
            userId: "oauth-user",
            scopes: ["profile", MCP_OAUTH_SCOPE],
          }),
        },
      ),
    ).resolves.toEqual({ ok: true, method: "oauth", userId: "oauth-user" });
  });

  it("rejects bearer tokens without the MCP scope", async () => {
    await expect(
      resolveMcpAuthenticatedUser(
        { authorization: "Bearer valid-token" },
        {
          verifyApiKey: vi.fn(),
          verifyOAuthBearer: vi.fn().mockResolvedValue({
            userId: "oauth-user",
            scopes: ["profile"],
          }),
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      error: "Insufficient OAuth scope",
    });
  });

  it("rejects an empty explicit bearer token without falling back", async () => {
    await expect(
      resolveMcpAuthenticatedUser(
        { authorization: "   ", sessionUserId: "session-user" },
        { verifyApiKey: vi.fn(), verifyOAuthBearer: vi.fn() },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid OAuth bearer token",
    });
  });

  it("falls back to browser session when no explicit credential is present", async () => {
    await expect(
      resolveMcpAuthenticatedUser(
        { sessionUserId: "session-user" },
        { verifyApiKey: vi.fn(), verifyOAuthBearer: vi.fn() },
      ),
    ).resolves.toEqual({
      ok: true,
      method: "session",
      userId: "session-user",
    });
  });
});
