import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { auth, getSession } from "@auth/server";
import type { Session } from "@auth/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mcpServer, withUserContext } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";

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

const streamableTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: randomUUID,
  enableDnsRebindingProtection: false,
});

const transportReady = mcpServer.connect(streamableTransport);

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
    allowHeaders: ["Content-Type", "MCP-Session-Id", "x-api-key"],
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
  let userId: string | null = null;

  // Try API key authentication first
  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader) {
    try {
      const apiKeyResult = await auth.api.verifyApiKey({
        body: { key: apiKeyHeader },
      });

      if (apiKeyResult?.valid && apiKeyResult.key) {
        userId = apiKeyResult.key.userId;
      }
    } catch (error) {
      console.error("API key verification error:", error);
    }
  }

  // Fall back to session authentication
  if (!userId) {
    const user = c.get("user");
    if (user?.id) {
      userId = user.id;
    }
  }

  // Require authentication via either method
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { incoming, outgoing } = c.env;
  if (!incoming || !outgoing) {
    console.error("Streamable transport requires Node bindings");
    return c.json({ error: "MCP transport unavailable" }, 500);
  }

  await transportReady;

  try {
    await withUserContext(userId, async () => {
      await streamableTransport.handleRequest(incoming, outgoing);
    });
    return new Response(null, {
      status: 200,
      headers: { [MCP_ALREADY_SENT_HEADER]: "true" },
    });
  } catch (error) {
    console.error("MCP endpoint error:", error);

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
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
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
