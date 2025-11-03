import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@db/kysely";
import { getRtmClient, RtmApiError } from "@rtm-client/client";
import { getOrCreateTimeline } from "@rtm-client/timeline";

// Use Zod schemas for MCP tool definitions
const mcpServer = new McpServer({
  name: process.env.MCP_SERVER_NAME || "rtm-mcp-server",
  version: process.env.MCP_SERVER_VERSION || "1.0.0",
});

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

// Resources - provide read-only data access
mcpServer.registerResource(
  "rtm_lists",
  {
    uri: "rtm://lists",
    name: "RTM Lists",
    description: "User's Remember The Milk lists",
    mimeType: "application/json",
  },
  async () => {
    // TODO: Get userId from MCP context
    const userId = "current_user_id";

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const lists = await rtm.getLists(authToken);

    return {
      contents: [{
        uri: "rtm://lists",
        mimeType: "application/json",
        text: JSON.stringify(lists, null, 2),
      }],
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
      filter: z.string().optional().describe("RTM filter syntax (e.g., 'priority:1')"),
    },
  },
  async ({ listId, filter }) => {
    // TODO: Get userId from MCP context
    const userId = "current_user_id";

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);

    try {
      const tasks = await rtm.getTasks(authToken, listId, filter);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(tasks, null, 2),
        }],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        return {
          content: [{
            type: "text",
            text: `RTM API Error: ${error.message}`,
          }],
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
      parse: z.boolean().optional().default(true).describe("Parse Smart Add syntax"),
    },
  },
  async ({ name, listId, parse }) => {
    const userId = "current_user_id";

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);

    try {
      const result = await rtm.addTask(authToken, timeline, name, listId, parse);

      return {
        content: [{
          type: "text",
          text: `✅ Task created: ${name}\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    } catch (error) {
      if (error instanceof RtmApiError && error.isInvalidToken()) {
        return {
          content: [{
            type: "text",
            text: "Your RTM token is invalid. Please reconnect your account at /rtm/start",
          }],
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
    const userId = "current_user_id";

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);

    try {
      const result = await rtm.completeTask(
        authToken,
        timeline,
        listId,
        taskseriesId,
        taskId
      );

      return {
        content: [{
          type: "text",
          text: `✅ Task completed!\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        return {
          content: [{
            type: "text",
            text: `Failed to complete task: ${error.message}`,
          }],
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
    description: "Set the priority of a task (1=highest, 2=high, 3=normal, N=none)",
    inputSchema: {
      listId: z.string(),
      taskseriesId: z.string(),
      taskId: z.string(),
      priority: z.enum(["1", "2", "3", "N"]).describe("Priority level"),
    },
  },
  async ({ listId, taskseriesId, taskId, priority }) => {
    const userId = "current_user_id";

    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);

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
        content: [{
          type: "text",
          text: `✅ Priority updated to ${priority}`,
        }],
      };
    } catch (error) {
      if (error instanceof RtmApiError) {
        return {
          content: [{
            type: "text",
            text: `Failed to set priority: ${error.message}`,
          }],
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
      dueDate: z.string().optional().describe("Due date (e.g., 'today', 'tomorrow', '2024-12-31')"),
    },
  },
  ({ taskName, priority, dueDate }) => {
    let smartAddText = taskName;

    if (priority) smartAddText += ` !${priority}`;
    if (dueDate) smartAddText += ` ^${dueDate}`;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Create this task in RTM using Smart Add syntax: "${smartAddText}"`,
        },
      }],
    };
  }
);

export { mcpServer };
