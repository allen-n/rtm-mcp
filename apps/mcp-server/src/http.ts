import { randomUUID } from "node:crypto";
import type { Session } from "@auth/server";
import { auth, getSession } from "@auth/server";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authLogger, httpLogger, mcpLogger } from "./logger.js";
import { mcpServer, withTransportUserContext } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";

type SessionResult = NonNullable<Session>;

type Variables = {
  user: SessionResult["user"] | null;
  session: SessionResult["session"] | null;
};

const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
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
    exposeHeaders: ["MCP-Session-Id"],
    allowHeaders: [
      "Content-Type",
      "MCP-Session-Id",
      "x-api-key",
      "Accept",
      "x-custom-auth-headers",
    ],
  })
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

// Mount routes
app.route("/rtm", authRoutes());
app.route("/webhook", webhookRoutes());

app.all("/mcp", async (c) => {
  const requestId = randomUUID();
  httpLogger.info("MCP request received", { requestId });

  let userId: string | null = null;

  // Try API key authentication first
  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader) {
    authLogger.info("API key found in header", { requestId });
    try {
      const apiKeyResult = await auth.api.verifyApiKey({
        body: { key: apiKeyHeader },
      });

      if (apiKeyResult?.valid && apiKeyResult.key) {
        userId = apiKeyResult.key.userId;
        authLogger.info("API key authentication successful", {
          userId,
          requestId,
        });
      } else {
        authLogger.warn("API key invalid", { requestId });
      }
    } catch (error) {
      authLogger.error(
        "API key verification error",
        error,
        undefined,
        requestId
      );
    }
  } else {
    authLogger.info("No API key in header, trying session auth", { requestId });
  }

  // Fall back to session authentication
  if (!userId) {
    const user = c.get("user");
    if (user?.id) {
      userId = user.id;
      authLogger.info("Session authentication successful", {
        userId,
        requestId,
      });
    } else {
      authLogger.warn("No session user found", { requestId });
    }
  }

  // Require authentication via either method
  if (!userId) {
    authLogger.error(
      "Unauthorized - no valid authentication",
      undefined,
      undefined,
      requestId
    );
    return c.json({ error: "Unauthorized" }, 401);
  }

  mcpLogger.info("Starting MCP transport handler", { userId, requestId });
  try {
    // Create a new transport for each request (per @hono/mcp pattern)
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: randomUUID,
      enableDnsRebindingProtection: process.env.NODE_ENV === "production",
    });

    httpLogger.debug("Connecting transport to MCP server", { requestId });
    await mcpServer.connect(transport);
    httpLogger.debug("Transport connected", { requestId });

    let response: Response | undefined;
    await withTransportUserContext(userId, true, async () => {
      mcpLogger.debug("Handling MCP request in user context", {
        userId,
        requestId,
      });
      response = await transport.handleRequest(c);
      mcpLogger.debug("MCP handleRequest completed", { userId, requestId });
    });
    mcpLogger.info("MCP request completed successfully", { userId, requestId });

    // Return the response from the transport - CORS middleware will add headers
    return response;
  } catch (error) {
    mcpLogger.error("MCP endpoint error", error, userId, requestId);
    return c.json({ error: "Internal server error" }, 500);
  }
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
    500
  );
});

export { app };
