import { randomUUID } from "node:crypto";
import { oauthResourceClient } from "@auth/oauth-resource";
import type { Session } from "@auth/server";
import { auth, getSession } from "@auth/server";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { authLogger, httpLogger, mcpLogger } from "./logger.js";
import { createMcpServer, mcpServer, withTransportUserContext } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";
import { apiRoutes } from "./routes/api.js";
import { RelaxedStreamableHTTPTransport } from "./relaxed-http.js";
import { getStaticDoc } from "./static-docs.js";
import {
  createProtectedResourceMetadata,
  createWwwAuthenticateHeader,
  getMcpResourceUrl,
  resolveMcpAuthenticatedUser,
} from "./mcp-auth.js";

type SessionResult = NonNullable<Session>;

type Variables = {
  user: SessionResult["user"] | null;
  session: SessionResult["session"] | null;
};

const app = new Hono<{ Variables: Variables }>();

const transport = new StreamableHTTPTransport({
  sessionIdGenerator: randomUUID,
  enableDnsRebindingProtection: process.env.NODE_ENV === "production",
});
let transportReady: Promise<void> | null = null;

const relaxedTransport = new RelaxedStreamableHTTPTransport({
  enableJsonResponse: true,
  // No session id generator to allow stateless JSON-only clients.
});
let relaxedTransportReady: Promise<void> | null = null;
const mcpServerJson = createMcpServer();

// Middleware
app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "";
      // Allow any localhost origin
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return origin;
      }
      // Allow configured web app URL
      if (process.env.WEB_APP_URL && origin === process.env.WEB_APP_URL) {
        return origin;
      }
      // Reject other origins
      return "";
    },
    credentials: true,
    exposeHeaders: ["MCP-Session-Id", "WWW-Authenticate"],
    allowHeaders: [
      "Content-Type",
      "MCP-Session-Id",
      "x-api-key",
      "Authorization",
      "Accept",
      "x-custom-auth-headers",
    ],
  }),
);

// Session middleware
app.use("*", async (c, next) => {
  const session = await getSession(c.req.raw);

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Mount BetterAuth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

function protectedResourceMetadataResponse() {
  return new Response(
    JSON.stringify(
      createProtectedResourceMetadata({
        appBaseUrl: process.env.APP_BASE_URL,
        webAppUrl: process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL,
      }),
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control":
          "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",
      },
    },
  );
}

function rewriteRequestPath(request: Request, pathname: string) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

app.get(
  "/.well-known/oauth-protected-resource/mcp",
  protectedResourceMetadataResponse,
);
app.get(
  "/.well-known/oauth-protected-resource",
  protectedResourceMetadataResponse,
);
app.get("/.well-known/oauth-authorization-server", (c) => {
  return auth.handler(
    rewriteRequestPath(
      c.req.raw,
      "/api/auth/.well-known/oauth-authorization-server",
    ),
  );
});

// Mount routes
app.route("/rtm", authRoutes());
app.route("/webhook", webhookRoutes());
app.route("/api/v1", apiRoutes());

function mcpAuthErrorResponse(status: 401 | 403, error: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (status === 401) {
    headers.set("WWW-Authenticate", createWwwAuthenticateHeader());
  } else if (status === 403) {
    // RFC 6750 §3.1: insufficient scope SHOULD return a challenge so the
    // client can re-request authorization with the required scope.
    headers.set(
      "WWW-Authenticate",
      createWwwAuthenticateHeader(undefined, "insufficient_scope"),
    );
  }
  return new Response(JSON.stringify({ error }), { status, headers });
}

async function handleMcpRequest(
  c: Context,
  options: { relaxed: boolean; allowOAuth: boolean },
) {
  const requestId = randomUUID();
  httpLogger.info("MCP request received", {
    requestId,
    relaxed: options.relaxed,
  });

  const authResult = await resolveMcpAuthenticatedUser(
    {
      apiKey: c.req.header("x-api-key"),
      authorization: options.allowOAuth ? c.req.header("Authorization") : null,
      sessionUserId: c.get("user")?.id,
    },
    {
      verifyApiKey: async (apiKey) => {
        authLogger.info("API key found in header", { requestId });
        try {
          const apiKeyResult = await auth.api.verifyApiKey({
            body: { key: apiKey },
          });
          return apiKeyResult?.valid && apiKeyResult.key
            ? apiKeyResult.key.referenceId
            : null;
        } catch (error) {
          authLogger.error(
            "API key verification error",
            error,
            undefined,
            requestId,
          );
          return null;
        }
      },
      verifyOAuthBearer: async (bearerToken) => {
        try {
          const payload = await oauthResourceClient.verifyAccessToken(
            bearerToken,
            {
              verifyOptions: {
                audience: getMcpResourceUrl(),
              },
            },
          );
          const scopes = payload.scope ?? payload.scopes;
          return {
            userId: typeof payload.sub === "string" ? payload.sub : null,
            scopes:
              typeof scopes === "string" || Array.isArray(scopes)
                ? scopes
                : null,
          };
        } catch (error) {
          authLogger.warn("OAuth bearer verification failed", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      },
    },
  );

  if (!authResult.ok) {
    authLogger.error(authResult.error, undefined, undefined, requestId);
    return mcpAuthErrorResponse(authResult.status, authResult.error);
  }

  const userId = authResult.userId;
  authLogger.info("MCP authentication successful", {
    method: authResult.method,
    userId,
    requestId,
  });

  mcpLogger.info("Starting MCP transport handler", { userId, requestId });
  try {
    if (options.relaxed) {
      if (!relaxedTransportReady) {
        httpLogger.debug("Connecting relaxed transport to MCP server", {
          requestId,
        });
        relaxedTransportReady = mcpServerJson.connect(relaxedTransport as any);
      }
      await relaxedTransportReady;
      httpLogger.debug("Relaxed transport connected", { requestId });
    } else {
      if (!transportReady) {
        httpLogger.debug("Connecting transport to MCP server", { requestId });
        transportReady = mcpServer.connect(transport);
      }
      await transportReady;
      httpLogger.debug("Transport connected", { requestId });
    }

    let response: Response | undefined;
    await withTransportUserContext(userId, true, async () => {
      mcpLogger.debug("Handling MCP request in user context", {
        userId,
        requestId,
      });
      response = options.relaxed
        ? await relaxedTransport.handleRequest(c)
        : await transport.handleRequest(c);
      mcpLogger.debug("MCP handleRequest completed", { userId, requestId });
    });
    mcpLogger.info("MCP request completed successfully", { userId, requestId });

    // Return the response from the transport - CORS middleware will add headers
    return response;
  } catch (error) {
    mcpLogger.error("MCP endpoint error", error, userId, requestId);
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    return c.json({ error: "Internal server error" }, 500);
  }
}

app.all("/mcp", (c) =>
  handleMcpRequest(c, { relaxed: false, allowOAuth: true }),
);
app.all("/mcp/json", (c) =>
  handleMcpRequest(c, { relaxed: true, allowOAuth: false }),
);

// llms.txt - AI-friendly overview
app.get("/llms.txt", async (c) => {
  const llms = await getStaticDoc("llms.txt");
  return c.text(llms);
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mcp: {
      transport: "http",
      method: "per-request",
    },
  });
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
    },
    500,
  );
});

export { app };
