import { auth, getSession } from "@auth/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mcpServer } from "./mcp.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const app = new Hono<{ Variables: Variables }>();

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
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
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
app.post("/mcp", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Create transport for this request
  const transport = new StreamableHTTPServerTransport("/mcp", c.req.raw);

  // Connect MCP server to transport
  await mcpServer.connect(transport);

  // The transport handles the response
  return new Response(null);
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
