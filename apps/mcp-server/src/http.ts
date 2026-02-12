import { randomUUID } from "node:crypto";
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
app.route("/api/v1", apiRoutes());

async function handleMcpRequest(
  c: Context,
  options: { relaxed: boolean }
) {
  const requestId = randomUUID();
  httpLogger.info("MCP request received", {
    requestId,
    relaxed: options.relaxed,
  });

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

app.all("/mcp", (c) => handleMcpRequest(c, { relaxed: false }));
app.all("/mcp/json", (c) => handleMcpRequest(c, { relaxed: true }));

// llms.txt - AI-friendly overview
app.get("/llms.txt", (c) => {
  return c.text(`# RTM MCP Server

> Remember The Milk API for AI agents

## Overview

This service provides a REST API and MCP (Model Context Protocol) server for managing tasks in Remember The Milk (RTM). It enables AI agents to create, read, update, and delete tasks, lists, tags, notes, and more.

## Authentication

All API requests require authentication via \`x-api-key\` header. Get your API key from the web app at /settings after connecting your RTM account.

## API Endpoints

- \`GET /api/v1/tools\` - List all available tools with schemas
- \`POST /api/v1/invoke\` - Call any tool by name
- \`GET /api/v1/skills.md\` - Detailed usage guide for AI agents
- \`GET /health\` - Health check

## Quick Start

\`\`\`bash
# List your tasks
curl -X POST https://your-domain.com/api/v1/invoke \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your-api-key" \\
  -d '{"tool": "get_tasks", "input": {"filter": "due:today"}}'

# Add a task with Smart Add syntax
curl -X POST https://your-domain.com/api/v1/invoke \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your-api-key" \\
  -d '{"tool": "add_task", "input": {"name": "Buy groceries ^tomorrow !1 #shopping"}}'
\`\`\`

## Available Tools

### Tasks
- get_tasks - Retrieve tasks with optional filters
- add_task - Create new task (supports Smart Add)
- complete_task - Mark task complete
- uncomplete_task - Mark task incomplete
- delete_task - Delete task permanently
- set_priority - Set priority (1/2/3/N)
- set_due_date - Set/clear due date
- set_start_date - Set/clear start date
- rename_task - Change task name
- set_recurrence - Set repeat pattern
- set_estimate - Set time estimate
- set_url - Attach URL
- postpone_task - Postpone by one day
- move_task - Move to different list

### Tags
- get_tags - List all tags
- add_tags - Add tags to task
- remove_tags - Remove tags from task
- set_tags - Replace all tags

### Notes
- add_note - Add note to task
- edit_note - Edit existing note
- delete_note - Delete note

### Lists
- get_lists - List all lists
- create_list - Create new list
- rename_list - Rename list
- archive_list - Archive list
- delete_list - Delete list

### Locations
- get_locations - List saved locations
- set_location - Set task location

### Settings
- get_settings - Get user settings

## RTM Filter Syntax

- \`due:today\` - Due today
- \`dueBefore:today\` - Overdue
- \`dueWithin:"7 days"\` - Due within 7 days
- \`priority:1\` - High priority
- \`list:Inbox\` - In specific list
- \`tag:work\` - Has tag
- \`status:incomplete\` - Not completed

## Smart Add Syntax

- \`^date\` - Due date (e.g., \`^tomorrow\`)
- \`!priority\` - Priority (e.g., \`!1\`)
- \`#tag\` - Add tag (e.g., \`#work\`)
- \`@location\` - Set location
- \`=estimate\` - Time estimate (e.g., \`=30min\`)

## Documentation

- Full skills guide: GET /api/v1/skills.md
- Tool schemas: GET /api/v1/tools
- MCP protocol: POST /mcp (for MCP-compatible clients)
`);
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
