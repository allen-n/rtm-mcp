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

export async function withTransportUserContext<T>(
  userId: string,
  isHttpTransport: boolean,
  callback: () => Promise<T>
): Promise<T> {
  if (isHttpTransport) {
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
    (error instanceof RtmApiError && error.isInvalidToken()) ||
    (error instanceof Error && error.message.includes("RTM token is invalid"))
  ) {
    return invalidTokenResponse();
  }
  return null;
}

function handleRtmError(error: unknown, action: string) {
  if (error instanceof RtmApiError) {
    if (error.isInvalidToken()) {
      return invalidTokenResponse();
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to ${action}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
  throw error;
}

// Task identifiers schema (used by many task operations)
const taskIdentifiersSchema = {
  listId: z.string().describe("List ID containing the task"),
  taskseriesId: z.string().describe("Task series ID"),
  taskId: z.string().describe("Task ID"),
};

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

  // ============================================
  // RESOURCES
  // ============================================

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

  mcpServer.registerResource(
    "rtm_tags",
    "rtm://tags",
    {
      title: "RTM Tags",
      description: "User's Remember The Milk tags",
      mimeType: "application/json",
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);
      const tags = await rtm.getTags(authToken);

      return {
        contents: [
          {
            uri: "rtm://tags",
            mimeType: "application/json",
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }
  );

  mcpServer.registerResource(
    "rtm_locations",
    "rtm://locations",
    {
      title: "RTM Locations",
      description: "User's Remember The Milk locations",
      mimeType: "application/json",
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);
      const locations = await rtm.getLocations(authToken);

      return {
        contents: [
          {
            uri: "rtm://locations",
            mimeType: "application/json",
            text: JSON.stringify(locations, null, 2),
          },
        ],
      };
    }
  );

  // ============================================
  // TASK TOOLS
  // ============================================

  mcpServer.registerTool(
    "get_tasks",
    {
      title: "Get Tasks",
      description: "Retrieve tasks from Remember The Milk. Use filter syntax like 'priority:1', 'due:today', 'tag:work', 'list:Inbox', 'status:incomplete'",
      inputSchema: {
        listId: z.string().optional().describe("Specific list ID to filter by"),
        filter: z.string().optional().describe("RTM filter syntax (e.g., 'priority:1 AND due:today')"),
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
        return handleRtmError(error, "get tasks");
      }
    }
  );

  mcpServer.registerTool(
    "add_task",
    {
      title: "Add Task",
      description: "Create a new task. Supports Smart Add syntax: 'Buy milk ^tomorrow !1 #groceries' (^due, !priority, #tag, @location, =estimate)",
      inputSchema: {
        name: z.string().describe("Task name (supports Smart Add syntax)"),
        listId: z.string().optional().describe("List ID to add task to"),
        parse: z.boolean().optional().default(true).describe("Parse Smart Add syntax"),
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
        const result = await rtm.addTask(authToken, timeline, name, listId, parse);
        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Task created: ${name}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "add task");
      }
    }
  );

  mcpServer.registerTool(
    "complete_task",
    {
      title: "Complete Task",
      description: "Mark a task as complete",
      inputSchema: taskIdentifiersSchema,
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
        const result = await rtm.completeTask(authToken, timeline, listId, taskseriesId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Task completed!\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "complete task");
      }
    }
  );

  mcpServer.registerTool(
    "uncomplete_task",
    {
      title: "Uncomplete Task",
      description: "Mark a completed task as not done",
      inputSchema: taskIdentifiersSchema,
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
        const result = await rtm.uncompleteTask(authToken, timeline, listId, taskseriesId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `↩️ Task marked incomplete\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "uncomplete task");
      }
    }
  );

  mcpServer.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "Permanently delete a task",
      inputSchema: taskIdentifiersSchema,
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
        const result = await rtm.deleteTask(authToken, timeline, listId, taskseriesId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `🗑️ Task deleted\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "delete task");
      }
    }
  );

  mcpServer.registerTool(
    "set_priority",
    {
      title: "Set Task Priority",
      description: "Set task priority (1=highest, 2=high, 3=normal, N=none)",
      inputSchema: {
        ...taskIdentifiersSchema,
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
        await rtm.setPriority(authToken, timeline, listId, taskseriesId, taskId, priority);
        const priorityLabels: Record<string, string> = {
          "1": "highest (!1)",
          "2": "high (!2)",
          "3": "normal (!3)",
          "N": "none",
        };
        return {
          content: [
            {
              type: "text" as const,
              text: `⚡ Priority set to ${priorityLabels[priority]}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set priority");
      }
    }
  );

  mcpServer.registerTool(
    "set_due_date",
    {
      title: "Set Due Date",
      description: "Set or clear a task's due date. Supports natural language like 'tomorrow', 'next monday', '2024-12-31'",
      inputSchema: {
        ...taskIdentifiersSchema,
        due: z.string().optional().describe("Due date (natural language or ISO format). Omit to clear."),
        hasDueTime: z.boolean().optional().describe("Whether the due date includes a specific time"),
      },
    },
    async ({ listId, taskseriesId, taskId, due, hasDueTime }) => {
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
        await rtm.setDueDate(authToken, timeline, listId, taskseriesId, taskId, due, hasDueTime, true);
        return {
          content: [
            {
              type: "text" as const,
              text: due ? `📅 Due date set to: ${due}` : `📅 Due date cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set due date");
      }
    }
  );

  mcpServer.registerTool(
    "set_start_date",
    {
      title: "Set Start Date",
      description: "Set or clear a task's start date",
      inputSchema: {
        ...taskIdentifiersSchema,
        start: z.string().optional().describe("Start date (natural language or ISO format). Omit to clear."),
        hasStartTime: z.boolean().optional().describe("Whether the start date includes a specific time"),
      },
    },
    async ({ listId, taskseriesId, taskId, start, hasStartTime }) => {
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
        await rtm.setStartDate(authToken, timeline, listId, taskseriesId, taskId, start, hasStartTime, true);
        return {
          content: [
            {
              type: "text" as const,
              text: start ? `🚀 Start date set to: ${start}` : `🚀 Start date cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set start date");
      }
    }
  );

  mcpServer.registerTool(
    "rename_task",
    {
      title: "Rename Task",
      description: "Change a task's name",
      inputSchema: {
        ...taskIdentifiersSchema,
        name: z.string().describe("New task name"),
      },
    },
    async ({ listId, taskseriesId, taskId, name }) => {
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
        await rtm.setTaskName(authToken, timeline, listId, taskseriesId, taskId, name);
        return {
          content: [
            {
              type: "text" as const,
              text: `✏️ Task renamed to: ${name}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "rename task");
      }
    }
  );

  mcpServer.registerTool(
    "set_recurrence",
    {
      title: "Set Recurrence",
      description: "Set a task to repeat. Examples: 'every day', 'every week', 'every month', 'every 2 weeks', 'after 3 days'",
      inputSchema: {
        ...taskIdentifiersSchema,
        repeat: z.string().optional().describe("Recurrence pattern (e.g., 'every week'). Omit to clear."),
      },
    },
    async ({ listId, taskseriesId, taskId, repeat }) => {
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
        await rtm.setRecurrence(authToken, timeline, listId, taskseriesId, taskId, repeat);
        return {
          content: [
            {
              type: "text" as const,
              text: repeat ? `🔁 Recurrence set: ${repeat}` : `🔁 Recurrence cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set recurrence");
      }
    }
  );

  mcpServer.registerTool(
    "set_estimate",
    {
      title: "Set Time Estimate",
      description: "Set a time estimate for a task. Examples: '30 min', '1 hour', '2 hours'",
      inputSchema: {
        ...taskIdentifiersSchema,
        estimate: z.string().optional().describe("Time estimate (e.g., '30 min', '2 hours'). Omit to clear."),
      },
    },
    async ({ listId, taskseriesId, taskId, estimate }) => {
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
        await rtm.setEstimate(authToken, timeline, listId, taskseriesId, taskId, estimate);
        return {
          content: [
            {
              type: "text" as const,
              text: estimate ? `⏱️ Estimate set: ${estimate}` : `⏱️ Estimate cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set estimate");
      }
    }
  );

  mcpServer.registerTool(
    "set_url",
    {
      title: "Set Task URL",
      description: "Attach a URL/link to a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        url: z.string().optional().describe("URL to attach. Omit to clear."),
      },
    },
    async ({ listId, taskseriesId, taskId, url }) => {
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
        await rtm.setUrl(authToken, timeline, listId, taskseriesId, taskId, url);
        return {
          content: [
            {
              type: "text" as const,
              text: url ? `🔗 URL set: ${url}` : `🔗 URL cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set URL");
      }
    }
  );

  mcpServer.registerTool(
    "postpone_task",
    {
      title: "Postpone Task",
      description: "Move a task's due date forward by one day",
      inputSchema: taskIdentifiersSchema,
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
        const result = await rtm.postponeTask(authToken, timeline, listId, taskseriesId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `⏭️ Task postponed\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "postpone task");
      }
    }
  );

  mcpServer.registerTool(
    "move_task",
    {
      title: "Move Task to List",
      description: "Move a task from one list to another",
      inputSchema: {
        fromListId: z.string().describe("Source list ID"),
        toListId: z.string().describe("Destination list ID"),
        taskseriesId: z.string().describe("Task series ID"),
        taskId: z.string().describe("Task ID"),
      },
    },
    async ({ fromListId, toListId, taskseriesId, taskId }) => {
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
        const result = await rtm.moveTask(authToken, timeline, fromListId, toListId, taskseriesId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `📦 Task moved to new list\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "move task");
      }
    }
  );

  // ============================================
  // TAG TOOLS
  // ============================================

  mcpServer.registerTool(
    "get_tags",
    {
      title: "Get Tags",
      description: "Get all tags in your RTM account",
      inputSchema: {},
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);

      try {
        const tags = await rtm.getTags(authToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(tags, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "get tags");
      }
    }
  );

  mcpServer.registerTool(
    "add_tags",
    {
      title: "Add Tags",
      description: "Add tags to a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        tags: z.string().describe("Comma-separated tags to add (e.g., 'work,urgent')"),
      },
    },
    async ({ listId, taskseriesId, taskId, tags }) => {
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
        const result = await rtm.addTags(authToken, timeline, listId, taskseriesId, taskId, tags);
        return {
          content: [
            {
              type: "text" as const,
              text: `🏷️ Tags added: ${tags}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "add tags");
      }
    }
  );

  mcpServer.registerTool(
    "remove_tags",
    {
      title: "Remove Tags",
      description: "Remove tags from a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        tags: z.string().describe("Comma-separated tags to remove"),
      },
    },
    async ({ listId, taskseriesId, taskId, tags }) => {
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
        const result = await rtm.removeTags(authToken, timeline, listId, taskseriesId, taskId, tags);
        return {
          content: [
            {
              type: "text" as const,
              text: `🏷️ Tags removed: ${tags}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "remove tags");
      }
    }
  );

  mcpServer.registerTool(
    "set_tags",
    {
      title: "Set Tags",
      description: "Replace all tags on a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        tags: z.string().describe("Comma-separated tags (replaces existing tags)"),
      },
    },
    async ({ listId, taskseriesId, taskId, tags }) => {
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
        const result = await rtm.setTags(authToken, timeline, listId, taskseriesId, taskId, tags);
        return {
          content: [
            {
              type: "text" as const,
              text: `🏷️ Tags set to: ${tags}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set tags");
      }
    }
  );

  // ============================================
  // NOTE TOOLS
  // ============================================

  mcpServer.registerTool(
    "add_note",
    {
      title: "Add Note",
      description: "Add a note to a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        title: z.string().describe("Note title"),
        text: z.string().describe("Note body text"),
      },
    },
    async ({ listId, taskseriesId, taskId, title, text }) => {
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
        const note = await rtm.addNote(authToken, timeline, listId, taskseriesId, taskId, title, text);
        return {
          content: [
            {
              type: "text" as const,
              text: `📝 Note added: ${title}\n\n${JSON.stringify(note, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "add note");
      }
    }
  );

  mcpServer.registerTool(
    "edit_note",
    {
      title: "Edit Note",
      description: "Edit an existing note",
      inputSchema: {
        noteId: z.string().describe("Note ID to edit"),
        title: z.string().describe("New note title"),
        text: z.string().describe("New note body text"),
      },
    },
    async ({ noteId, title, text }) => {
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
        const note = await rtm.editNote(authToken, timeline, noteId, title, text);
        return {
          content: [
            {
              type: "text" as const,
              text: `📝 Note updated\n\n${JSON.stringify(note, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "edit note");
      }
    }
  );

  mcpServer.registerTool(
    "delete_note",
    {
      title: "Delete Note",
      description: "Delete a note from a task",
      inputSchema: {
        noteId: z.string().describe("Note ID to delete"),
      },
    },
    async ({ noteId }) => {
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
        await rtm.deleteNote(authToken, timeline, noteId);
        return {
          content: [
            {
              type: "text" as const,
              text: `🗑️ Note deleted`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "delete note");
      }
    }
  );

  // ============================================
  // LIST TOOLS
  // ============================================

  mcpServer.registerTool(
    "get_lists",
    {
      title: "Get Lists",
      description: "Get all lists in your RTM account",
      inputSchema: {},
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);

      try {
        const lists = await rtm.getLists(authToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(lists, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "get lists");
      }
    }
  );

  mcpServer.registerTool(
    "create_list",
    {
      title: "Create List",
      description: "Create a new list. Can optionally be a Smart List with a filter.",
      inputSchema: {
        name: z.string().describe("List name"),
        filter: z.string().optional().describe("Optional filter for Smart List (e.g., 'priority:1')"),
      },
    },
    async ({ name, filter }) => {
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
        const list = await rtm.addList(authToken, timeline, name, filter);
        return {
          content: [
            {
              type: "text" as const,
              text: `📋 List created: ${name}\n\n${JSON.stringify(list, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "create list");
      }
    }
  );

  mcpServer.registerTool(
    "rename_list",
    {
      title: "Rename List",
      description: "Rename an existing list",
      inputSchema: {
        listId: z.string().describe("List ID to rename"),
        name: z.string().describe("New list name"),
      },
    },
    async ({ listId, name }) => {
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
        const list = await rtm.setListName(authToken, timeline, listId, name);
        return {
          content: [
            {
              type: "text" as const,
              text: `✏️ List renamed to: ${name}\n\n${JSON.stringify(list, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "rename list");
      }
    }
  );

  mcpServer.registerTool(
    "archive_list",
    {
      title: "Archive List",
      description: "Archive a list (hides it but preserves tasks)",
      inputSchema: {
        listId: z.string().describe("List ID to archive"),
      },
    },
    async ({ listId }) => {
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
        const list = await rtm.archiveList(authToken, timeline, listId);
        return {
          content: [
            {
              type: "text" as const,
              text: `📦 List archived\n\n${JSON.stringify(list, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "archive list");
      }
    }
  );

  mcpServer.registerTool(
    "delete_list",
    {
      title: "Delete List",
      description: "Permanently delete a list",
      inputSchema: {
        listId: z.string().describe("List ID to delete"),
      },
    },
    async ({ listId }) => {
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
        const list = await rtm.deleteList(authToken, timeline, listId);
        return {
          content: [
            {
              type: "text" as const,
              text: `🗑️ List deleted\n\n${JSON.stringify(list, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "delete list");
      }
    }
  );

  // ============================================
  // LOCATION TOOLS
  // ============================================

  mcpServer.registerTool(
    "get_locations",
    {
      title: "Get Locations",
      description: "Get all saved locations",
      inputSchema: {},
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);

      try {
        const locations = await rtm.getLocations(authToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(locations, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "get locations");
      }
    }
  );

  mcpServer.registerTool(
    "set_location",
    {
      title: "Set Task Location",
      description: "Set a location for a task",
      inputSchema: {
        ...taskIdentifiersSchema,
        locationId: z.string().optional().describe("Location ID. Omit to clear."),
      },
    },
    async ({ listId, taskseriesId, taskId, locationId }) => {
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
        await rtm.setLocation(authToken, timeline, listId, taskseriesId, taskId, locationId);
        return {
          content: [
            {
              type: "text" as const,
              text: locationId ? `📍 Location set` : `📍 Location cleared`,
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "set location");
      }
    }
  );

  // ============================================
  // SETTINGS TOOLS
  // ============================================

  mcpServer.registerTool(
    "get_settings",
    {
      title: "Get Settings",
      description: "Get user's RTM settings (timezone, date format, etc.)",
      inputSchema: {},
    },
    async () => {
      const userId = requireUserId();
      const rtm = getRtmClient();
      const authToken = await getUserRtmToken(userId);

      try {
        const settings = await rtm.getSettings(authToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(settings, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleRtmError(error, "get settings");
      }
    }
  );

  // ============================================
  // PROMPTS
  // ============================================

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

  mcpServer.registerPrompt(
    "weekly_review",
    {
      title: "Weekly Review",
      description: "Get tasks for a weekly review session",
      argsSchema: {},
    },
    () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please help me with a weekly review. First, get my tasks that are:
1. Overdue (filter: "dueBefore:today")
2. Due this week (filter: "due:today OR dueWithin:'7 days'")
3. High priority incomplete (filter: "priority:1 AND status:incomplete")

Then summarize what needs attention.`,
            },
          },
        ],
      };
    }
  );

  return mcpServer;
}

// Default server instance
export const mcpServer = createMcpServer();
