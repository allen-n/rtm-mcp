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
app.post("/mcp", async (c) => {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const transport = new StreamableHTTPServerTransport("/mcp", c.req.raw);

    await withUserContext(user.id, async () => {
      await mcpServer.connect(transport);
    });

    return transport.response;
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
