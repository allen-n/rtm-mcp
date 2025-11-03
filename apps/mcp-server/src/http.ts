import { auth, getSession } from "@auth/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mcpServer } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";

type Variables = {
  user: any;
  session: any;
};

const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use("*", logger());

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", process.env.WEB_APP_URL || ""].filter(
      Boolean
    ),
    credentials: true,
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

// MCP server endpoint using StreamableHTTP
// Note: MCP endpoint authentication disabled for now - implement session-based auth later
app.post("/mcp", async (c) => {
  // TODO: Implement proper session-based authentication with MCP context
  // const session = c.get("session");
  // if (!session) {
  //   return c.json({ error: "Unauthorized" }, 401);
  // }

  // For now, we'll use a simple approach: delegate to MCP SDK
  // The MCP SDK will handle the protocol negotiation
  try {
    const body = await c.req.json();

    // Create a stateless transport for this request
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // Connect the server to the transport
    await mcpServer.connect(transport);

    // Let the transport handle the MCP protocol
    // Since we can't directly use handleRequest with Hono's request/response,
    // we return a placeholder for now
    // TODO: Properly integrate MCP transport with Hono
    return c.json({ error: "MCP endpoint requires proper transport integration" }, 501);
  } catch (error) {
    console.error("MCP endpoint error:", error);
    return c.json({ error: "Internal server error" }, 500);
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
