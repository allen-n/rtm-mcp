import { describe, expect, it, vi } from "vitest";
import {
  MCP_OAUTH_SCOPE,
  createWwwAuthenticateHeader,
} from "../apps/mcp-server/src/mcp-auth";

vi.mock("@auth/server", () => ({
  auth: {
    api: {
      verifyApiKey: vi.fn(),
    },
    handler: vi.fn(() => new Response("auth")),
  },
  getSession: vi.fn(async () => null),
}));

vi.mock("@auth/oauth-resource", () => ({
  oauthResourceClient: {
    verifyAccessToken: vi.fn(),
  },
}));

vi.mock("@db/kysely", () => ({
  db: {},
}));

vi.mock("@rtm-client/client", () => ({
  getRtmClient: vi.fn(),
  RtmApiError: class RtmApiError extends Error {},
}));

vi.mock("@rtm-client/timeline", () => ({
  getOrCreateTimeline: vi.fn(),
}));

vi.mock("@rtm-client/webhook", () => ({
  verifyWebhookSignature: vi.fn(),
  parseWebhookEvent: vi.fn(),
}));

vi.mock("@hono/mcp", () => ({
  StreamableHTTPTransport: class {
    async handleRequest() {
      return new Response("mcp-ok");
    }
  },
}));

vi.mock("../apps/mcp-server/src/mcp.js", () => ({
  createMcpServer: () => ({
    connect: vi.fn(async () => undefined),
  }),
  mcpServer: {
    connect: vi.fn(async () => undefined),
  },
  withTransportUserContext: vi.fn(
    async (
      _userId: string,
      _isHttpTransport: boolean,
      callback: () => unknown,
    ) => callback(),
  ),
}));

vi.mock("../apps/mcp-server/src/relaxed-http.js", () => ({
  RelaxedStreamableHTTPTransport: class {
    async handleRequest() {
      return new Response("relaxed-ok");
    }
  },
}));

vi.mock("../apps/mcp-server/src/static-docs.js", () => ({
  getStaticDoc: vi.fn(async () => "docs"),
}));

describe("MCP OAuth routes", () => {
  it("serves protected resource metadata from the API origin", async () => {
    vi.stubEnv("APP_BASE_URL", "https://api.milkbridge.dev");
    vi.stubEnv("WEB_APP_URL", "https://milkbridge.dev");
    const { app } = await import("../apps/mcp-server/src/http");

    const res = await app.request("/.well-known/oauth-protected-resource/mcp");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      resource: "https://api.milkbridge.dev/mcp",
      authorization_servers: ["https://milkbridge.dev"],
      scopes_supported: [MCP_OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
    });
  });

  it("returns a WWW-Authenticate challenge for unauthenticated MCP requests", async () => {
    vi.stubEnv("APP_BASE_URL", "https://api.milkbridge.dev");
    const { app } = await import("../apps/mcp-server/src/http");

    const res = await app.request("/mcp", { method: "POST" });

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      createWwwAuthenticateHeader("https://api.milkbridge.dev"),
    );
  });
});
