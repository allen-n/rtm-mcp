import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { auth, getSession } from "@auth/server";
import type { Session } from "@auth/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mcpServer, withTransportUserContext } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";
import { createTransportManager } from "./transport.js";
import { httpLogger, authLogger, mcpLogger } from "./logger.js";

type SessionResult = NonNullable<Session>;

type Variables = {
  user: SessionResult["user"] | null;
  session: SessionResult["session"] | null;
};

type NodeBindings = {
  incoming: IncomingMessage;
  outgoing: ServerResponse;
};

const MCP_ALREADY_SENT_HEADER = "x-hono-already-sent";

const app = new Hono<{ Bindings: NodeBindings; Variables: Variables }>();

// Initialize transport manager
const transportManager = createTransportManager();
const transportReady = transportManager.connect(mcpServer);

// Middleware
app.use("*", logger());

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", process.env.WEB_APP_URL || ""].filter(
      Boolean
    ),
    credentials: true,
    exposeHeaders: ["MCP-Session-Id"],
    allowHeaders: ["Content-Type", "MCP-Session-Id", "x-api-key", "Accept"],
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

app.post("/mcp", async (c) => {
  const requestId = randomUUID();
  httpLogger.info("MCP request received", { requestId });
  
  // Only handle HTTP transport requests
  if (!transportManager.isHttpTransport()) {
    httpLogger.error("MCP endpoint called but server is configured for STDIO transport", { requestId });
    return c.json({ error: "MCP HTTP transport not available" }, 503);
  }

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
        authLogger.info("API key authentication successful", { userId, requestId });
      } else {
        authLogger.warn("API key invalid", { requestId });
      }
    } catch (error) {
      authLogger.error("API key verification error", error, undefined, requestId);
    }
  } else {
    authLogger.info("No API key in header, trying session auth", { requestId });
  }

  // Fall back to session authentication
  if (!userId) {
    const user = c.get("user");
    if (user?.id) {
      userId = user.id;
      authLogger.info("Session authentication successful", { userId, requestId });
    } else {
      authLogger.warn("No session user found", { requestId });
    }
  }

  // Require authentication via either method
  if (!userId) {
    authLogger.error("Unauthorized - no valid authentication", undefined, undefined, requestId);
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { incoming, outgoing } = c.env;
  if (!incoming || !outgoing) {
    httpLogger.error("Streamable transport requires Node bindings", { requestId });
    return c.json({ error: "MCP transport unavailable" }, 500);
  }

  httpLogger.debug("Waiting for transport ready", { requestId });
  await transportReady;
  httpLogger.debug("Transport ready", { requestId });

  mcpLogger.info("Starting MCP transport handler", { userId, requestId });
  try {
    await withTransportUserContext(userId, true, async () => {
      mcpLogger.debug("Handling MCP request in user context", { userId, requestId });
      await transportManager.handleHttpRequest(incoming, outgoing);
      mcpLogger.debug("MCP handleRequest completed", { userId, requestId });
    });
    mcpLogger.info("MCP request completed successfully", { userId, requestId });
    return new Response(null, {
      status: 200,
      headers: { [MCP_ALREADY_SENT_HEADER]: "true" },
    });
  } catch (error) {
    mcpLogger.error("MCP endpoint error", error, userId, requestId);

    if (!outgoing.writableEnded) {
      outwardErrorResponse(outgoing);
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        [MCP_ALREADY_SENT_HEADER]: "true",
      },
    });
  }
});

// Health check
app.get("/health", (c) => {
  const transportStats = transportManager.getStats();
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    transport: {
      type: transportStats.transportType,
      status: transportStats.health.status,
      uptime: transportStats.uptime,
      requestCount: transportStats.health.requestCount,
      errorCount: transportStats.health.errorCount,
      lastError: transportStats.health.lastError,
    }
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

function outwardErrorResponse(res: ServerResponse) {
  try {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Internal server error" }));
  } catch (err) {
    console.error("Failed to finalize MCP error response:", err);
    try {
      res.end();
    } catch {
      // ignore
    }
  }
}
