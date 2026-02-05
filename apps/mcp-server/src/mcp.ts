import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@db/kysely";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getRtmClient, RtmApiError } from "@rtm-client/client";
import { getOrCreateTimeline } from "@rtm-client/timeline";
import { z } from "zod";
import { withHttpUserContext } from "./context.js";

const requestContext = new AsyncLocalStorage<{ userId: string }>();

function requireUserId(): string {
  const store = requestContext.getStore();
  if (!store?.userId) {
    throw new Error("Unauthorized: missing MCP user context");
  }
  return store.userId;
}

export function withUserContext<T>(userId: string, callback: () => Promise<T>) {
  return requestContext.run({ userId }, callback);
}

/**
 * Transport-aware user context wrapper
 * Uses HTTP context for HTTP transport, AsyncLocalStorage for STDIO
 */
export async function withTransportUserContext<T>(
  userId: string,
  isHttpTransport: boolean,
  callback: () => Promise<T>
): Promise<T> {
  if (isHttpTransport) {
    // Ensure AsyncLocalStorage is populated for HTTP requests too.
    return withUserContext(userId, () =>
      withHttpUserContext(userId, callback)
    );
  }
  return withUserContext(userId, callback);
}

// Helper to get user's RTM token
async function getUserRtmToken(userId: string) {
  const token = await db
    .selectFrom("rtm_tokens")
    .select(["auth_token", "status"])
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .executeTakeFirst();

  if (!token) {
    throw new Error(
      "No active RTM token found. Please connect your RTM account."
    );
  }

  return token.auth_token;
}

function invalidTokenResponse() {
  return {
    content: [
      {
        type: "text" as const,
        text: "Your RTM token is invalid. Please reconnect your account at /rtm/start",
      },
    ],
    isError: true,
  };
}

function handleTimelineError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("RTM token is invalid")
  ) {
    return invalidTokenResponse();
  }
  return null;
}

export function createMcpServer() {
  const mcpServer = new McpServer({
    name: process.env.MCP_SERVER_NAME || "rtm-mcp-server",
    version: process.env.MCP_SERVER_VERSION || "1.0.0",
    capabilities: {
      resources: {
        subscribe: false,
        listChanged: true,
      },
      tools: {
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
    },
  });

  // Resources - provide read-only data access
  mcpServer.registerResource(
    "rtm_lists",
    "rtm://lists",
    {
      title: "RTM Lists",
    description: "User's Remember The Milk lists",
    mimeType: "application/json",
  },
  async () => {
    const userId = requireUserId();
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const lists = await rtm.getLists(authToken);

    return {
      contents: [
        {
          uri: "rtm://lists",
          mimeType: "application/json",
          text: JSON.stringify(lists, null, 2),
        },
      ],
    };
    }
  );

// Tools - MCP SDK uses Zod for schemas
  mcpServer.registerTool(
    "get_tasks",
  {
    title: "Get Tasks",
    description: "Retrieve tasks from Remember The Milk",
    inputSchema: {
      listId: z.string().optional().describe("Specific list ID to filter by"),
      filter: z
        .string()
        .optional()
        .describe("RTM filter syntax (e.g., 'priority:1')"),
    },
  },
  async ({ listId, filter }) => {
    const userId = requireUserId();

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);

    try {
      const tasks = await rtm.getTasks(authToken, listId, filter);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `RTM API Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
    }
  );

  mcpServer.registerTool(
    "add_task",
  {
    title: "Add Task",
    description: "Create a new task in Remember The Milk",
    inputSchema: {
      name: z.string().describe("Task name (supports Smart Add syntax)"),
      listId: z.string().optional().describe("List ID to add task to"),
      parse: z
        .boolean()
        .optional()
        .default(true)
        .describe("Parse Smart Add syntax"),
    },
  },
  async ({ name, listId, parse }) => {
    const userId = requireUserId();

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    let timeline: string;
    try {
      timeline = await getOrCreateTimeline(userId, authToken);
    } catch (error) {
      const invalid = handleTimelineError(error);
      if (invalid) return invalid;
      throw error;
    }

    try {
      const result = await rtm.addTask(
        authToken,
        timeline,
        name,
        listId,
        parse
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Task created: ${name}\n\n${JSON.stringify(
              result,
              null,
              2
            )}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        if (error.isInvalidToken()) {
          return invalidTokenResponse();
        }
        return {
          content: [
            {
              type: "text",
              text: `Failed to add task: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
    }
  );

  mcpServer.registerTool(
    "complete_task",
  {
    title: "Complete Task",
    description: "Mark a task as complete in Remember The Milk",
    inputSchema: {
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    },
  },
  async ({ listId, taskseriesId, taskId }) => {
    const userId = requireUserId();

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    let timeline: string;
    try {
      timeline = await getOrCreateTimeline(userId, authToken);
    } catch (error) {
      const invalid = handleTimelineError(error);
      if (invalid) return invalid;
      throw error;
    }

    try {
      const result = await rtm.completeTask(
        authToken,
        timeline,
        listId,
        taskseriesId,
        taskId
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Task completed!\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        if (error.isInvalidToken()) {
          return invalidTokenResponse();
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to complete task: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
    }
  );

  mcpServer.registerTool(
    "set_priority",
  {
    title: "Set Task Priority",
    description:
      "Set the priority of a task (1=highest, 2=high, 3=normal, N=none)",
    inputSchema: {
      listId: z.string(),
      taskseriesId: z.string(),
      taskId: z.string(),
      priority: z.enum(["1", "2", "3", "N"]).describe("Priority level"),
    },
  },
  async ({ listId, taskseriesId, taskId, priority }) => {
    const userId = requireUserId();

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    let timeline: string;
    try {
      timeline = await getOrCreateTimeline(userId, authToken);
    } catch (error) {
      const invalid = handleTimelineError(error);
      if (invalid) return invalid;
      throw error;
    }

    try {
      await rtm.setPriority(
        authToken,
        timeline,
        listId,
        taskseriesId,
        taskId,
        priority
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Priority updated to ${priority}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        if (error.isInvalidToken()) {
          return invalidTokenResponse();
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to set priority: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
    }
  );

// Prompts - templated interactions
  mcpServer.registerPrompt(
    "create_daily_task",
  {
    title: "Create Daily Task",
    description: "Template for creating a task with Smart Add syntax",
    argsSchema: {
      taskName: z.string().describe("Name of the task"),
      priority: z.enum(["1", "2", "3"]).optional().describe("Priority level"),
      dueDate: z
        .string()
        .optional()
        .describe("Due date (e.g., 'today', 'tomorrow', '2024-12-31')"),
    },
  },
  ({ taskName, priority, dueDate }) => {
    let smartAddText = taskName;

    if (priority) smartAddText += ` !${priority}`;
    if (dueDate) smartAddText += ` ^${dueDate}`;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create this task in RTM using Smart Add syntax: "${smartAddText}"`,
          },
        },
      ],
    };
    }
  );

  return mcpServer;
}

// Default server instance for stdio and strict HTTP transport.
export const mcpServer = createMcpServer();
