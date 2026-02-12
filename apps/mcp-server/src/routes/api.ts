import { Hono } from "hono";
import { db } from "@db/kysely";
import { auth } from "@auth/server";
import { getRtmClient, RtmApiError } from "@rtm-client/client";
import { getOrCreateTimeline } from "@rtm-client/timeline";
import { z } from "zod";
import { authLogger } from "../logger.js";
import { getStaticDoc } from "../static-docs.js";

// Tool schemas for documentation
export const toolSchemas = {
  // Tasks
  get_tasks: {
    description: "Retrieve tasks from Remember The Milk. Supports RTM filter syntax.",
    input: z.object({
      listId: z.string().optional().describe("Specific list ID to filter by"),
      filter: z.string().optional().describe("RTM filter syntax (e.g., 'priority:1 AND due:today')"),
    }),
  },
  add_task: {
    description: "Create a new task. Supports Smart Add syntax: 'Buy milk ^tomorrow !1 #groceries'",
    input: z.object({
      name: z.string().describe("Task name (supports Smart Add syntax)"),
      listId: z.string().optional().describe("List ID to add task to"),
      parse: z.boolean().optional().default(true).describe("Parse Smart Add syntax"),
    }),
  },
  complete_task: {
    description: "Mark a task as complete",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    }),
  },
  uncomplete_task: {
    description: "Mark a completed task as not done",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    }),
  },
  delete_task: {
    description: "Permanently delete a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    }),
  },
  set_priority: {
    description: "Set task priority (1=highest, 2=high, 3=normal, N=none)",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      priority: z.enum(["1", "2", "3", "N"]).describe("Priority level"),
    }),
  },
  set_due_date: {
    description: "Set or clear a task's due date. Supports natural language.",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      due: z.string().optional().describe("Due date (natural language or ISO format). Omit to clear."),
      hasDueTime: z.boolean().optional().describe("Whether the due date includes a specific time"),
    }),
  },
  set_start_date: {
    description: "Set or clear a task's start date",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      start: z.string().optional().describe("Start date. Omit to clear."),
      hasStartTime: z.boolean().optional().describe("Whether the start date includes a specific time"),
    }),
  },
  rename_task: {
    description: "Change a task's name",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      name: z.string().describe("New task name"),
    }),
  },
  set_recurrence: {
    description: "Set a task to repeat. Examples: 'every day', 'every week', 'after 3 days'",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      repeat: z.string().optional().describe("Recurrence pattern. Omit to clear."),
    }),
  },
  set_estimate: {
    description: "Set a time estimate for a task. Examples: '30 min', '2 hours'",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      estimate: z.string().optional().describe("Time estimate. Omit to clear."),
    }),
  },
  set_url: {
    description: "Attach a URL/link to a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      url: z.string().optional().describe("URL to attach. Omit to clear."),
    }),
  },
  postpone_task: {
    description: "Move a task's due date forward by one day",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    }),
  },
  move_task: {
    description: "Move a task from one list to another",
    input: z.object({
      fromListId: z.string().describe("Source list ID"),
      toListId: z.string().describe("Destination list ID"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
    }),
  },
  // Tags
  get_tags: {
    description: "Get all tags in your RTM account",
    input: z.object({}),
  },
  add_tags: {
    description: "Add tags to a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      tags: z.string().describe("Comma-separated tags to add"),
    }),
  },
  remove_tags: {
    description: "Remove tags from a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      tags: z.string().describe("Comma-separated tags to remove"),
    }),
  },
  set_tags: {
    description: "Replace all tags on a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      tags: z.string().describe("Comma-separated tags (replaces existing)"),
    }),
  },
  // Notes
  add_note: {
    description: "Add a note to a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      title: z.string().describe("Note title"),
      text: z.string().describe("Note body text"),
    }),
  },
  edit_note: {
    description: "Edit an existing note",
    input: z.object({
      noteId: z.string().describe("Note ID to edit"),
      title: z.string().describe("New note title"),
      text: z.string().describe("New note body text"),
    }),
  },
  delete_note: {
    description: "Delete a note from a task",
    input: z.object({
      noteId: z.string().describe("Note ID to delete"),
    }),
  },
  // Lists
  get_lists: {
    description: "Get all lists in your RTM account",
    input: z.object({}),
  },
  create_list: {
    description: "Create a new list. Can optionally be a Smart List with a filter.",
    input: z.object({
      name: z.string().describe("List name"),
      filter: z.string().optional().describe("Optional filter for Smart List"),
    }),
  },
  rename_list: {
    description: "Rename an existing list",
    input: z.object({
      listId: z.string().describe("List ID to rename"),
      name: z.string().describe("New list name"),
    }),
  },
  archive_list: {
    description: "Archive a list (hides it but preserves tasks)",
    input: z.object({
      listId: z.string().describe("List ID to archive"),
    }),
  },
  delete_list: {
    description: "Permanently delete a list",
    input: z.object({
      listId: z.string().describe("List ID to delete"),
    }),
  },
  // Locations
  get_locations: {
    description: "Get all saved locations",
    input: z.object({}),
  },
  set_location: {
    description: "Set a location for a task",
    input: z.object({
      listId: z.string().describe("List ID containing the task"),
      taskseriesId: z.string().describe("Task series ID"),
      taskId: z.string().describe("Task ID"),
      locationId: z.string().optional().describe("Location ID. Omit to clear."),
    }),
  },
  // Settings
  get_settings: {
    description: "Get user's RTM settings (timezone, date format, etc.)",
    input: z.object({}),
  },
} as const;

type ToolName = keyof typeof toolSchemas;

// Helper to get user's RTM token
async function getUserRtmToken(userId: string) {
  const token = await db
    .selectFrom("rtm_tokens")
    .select(["auth_token", "status"])
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .executeTakeFirst();

  if (!token) {
    throw new ApiError(401, "No active RTM token found. Please connect your RTM account.");
  }

  return token.auth_token;
}

// Custom API error class
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Tool handlers - these mirror MCP tools but return clean JSON
const toolHandlers: Record<ToolName, (userId: string, input: any) => Promise<any>> = {
  // Tasks
  get_tasks: async (userId, { listId, filter }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    return rtm.getTasks(authToken, listId, filter);
  },

  add_task: async (userId, { name, listId, parse }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.addTask(authToken, timeline, name, listId, parse ?? true);
  },

  complete_task: async (userId, { listId, taskseriesId, taskId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.completeTask(authToken, timeline, listId, taskseriesId, taskId);
  },

  uncomplete_task: async (userId, { listId, taskseriesId, taskId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.uncompleteTask(authToken, timeline, listId, taskseriesId, taskId);
  },

  delete_task: async (userId, { listId, taskseriesId, taskId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.deleteTask(authToken, timeline, listId, taskseriesId, taskId);
  },

  set_priority: async (userId, { listId, taskseriesId, taskId, priority }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setPriority(authToken, timeline, listId, taskseriesId, taskId, priority);
    return { success: true, priority };
  },

  set_due_date: async (userId, { listId, taskseriesId, taskId, due, hasDueTime }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setDueDate(authToken, timeline, listId, taskseriesId, taskId, due, hasDueTime, true);
    return { success: true, due: due || null };
  },

  set_start_date: async (userId, { listId, taskseriesId, taskId, start, hasStartTime }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setStartDate(authToken, timeline, listId, taskseriesId, taskId, start, hasStartTime, true);
    return { success: true, start: start || null };
  },

  rename_task: async (userId, { listId, taskseriesId, taskId, name }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setTaskName(authToken, timeline, listId, taskseriesId, taskId, name);
    return { success: true, name };
  },

  set_recurrence: async (userId, { listId, taskseriesId, taskId, repeat }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setRecurrence(authToken, timeline, listId, taskseriesId, taskId, repeat);
    return { success: true, repeat: repeat || null };
  },

  set_estimate: async (userId, { listId, taskseriesId, taskId, estimate }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setEstimate(authToken, timeline, listId, taskseriesId, taskId, estimate);
    return { success: true, estimate: estimate || null };
  },

  set_url: async (userId, { listId, taskseriesId, taskId, url }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setUrl(authToken, timeline, listId, taskseriesId, taskId, url);
    return { success: true, url: url || null };
  },

  postpone_task: async (userId, { listId, taskseriesId, taskId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.postponeTask(authToken, timeline, listId, taskseriesId, taskId);
  },

  move_task: async (userId, { fromListId, toListId, taskseriesId, taskId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.moveTask(authToken, timeline, fromListId, toListId, taskseriesId, taskId);
  },

  // Tags
  get_tags: async (userId) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    return rtm.getTags(authToken);
  },

  add_tags: async (userId, { listId, taskseriesId, taskId, tags }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.addTags(authToken, timeline, listId, taskseriesId, taskId, tags);
  },

  remove_tags: async (userId, { listId, taskseriesId, taskId, tags }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.removeTags(authToken, timeline, listId, taskseriesId, taskId, tags);
  },

  set_tags: async (userId, { listId, taskseriesId, taskId, tags }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.setTags(authToken, timeline, listId, taskseriesId, taskId, tags);
  },

  // Notes
  add_note: async (userId, { listId, taskseriesId, taskId, title, text }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.addNote(authToken, timeline, listId, taskseriesId, taskId, title, text);
  },

  edit_note: async (userId, { noteId, title, text }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.editNote(authToken, timeline, noteId, title, text);
  },

  delete_note: async (userId, { noteId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.deleteNote(authToken, timeline, noteId);
    return { success: true };
  },

  // Lists
  get_lists: async (userId) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    return rtm.getLists(authToken);
  },

  create_list: async (userId, { name, filter }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.addList(authToken, timeline, name, filter);
  },

  rename_list: async (userId, { listId, name }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.setListName(authToken, timeline, listId, name);
  },

  archive_list: async (userId, { listId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.archiveList(authToken, timeline, listId);
  },

  delete_list: async (userId, { listId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    return rtm.deleteList(authToken, timeline, listId);
  },

  // Locations
  get_locations: async (userId) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    return rtm.getLocations(authToken);
  },

  set_location: async (userId, { listId, taskseriesId, taskId, locationId }) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    const timeline = await getOrCreateTimeline(userId, authToken);
    await rtm.setLocation(authToken, timeline, listId, taskseriesId, taskId, locationId);
    return { success: true, locationId: locationId || null };
  },

  // Settings
  get_settings: async (userId) => {
    const rtm = getRtmClient();
    const authToken = await getUserRtmToken(userId);
    return rtm.getSettings(authToken);
  },
};

// Auth middleware for API routes
async function authenticateRequest(c: any): Promise<string | null> {
  // Try API key authentication first
  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader) {
    try {
      const apiKeyResult = await auth.api.verifyApiKey({
        body: { key: apiKeyHeader },
      });

      if (apiKeyResult?.valid && apiKeyResult.key) {
        return apiKeyResult.key.userId;
      }
    } catch (error) {
      authLogger.error("API key verification error", error);
    }
  }

  // Fall back to session authentication (for browser-based calls)
  const user = c.get("user");
  if (user?.id) {
    return user.id;
  }

  return null;
}

export function apiRoutes() {
  const api = new Hono();
  const invokeSchema = z.object({
    tool: z.string(),
    input: z.record(z.any()).optional().default({}),
  });

  // GET /api/v1/tools - List all available tools with schemas
  api.get("/tools", (c) => {
    const tools = Object.entries(toolSchemas).map(([name, schema]) => ({
      name,
      description: schema.description,
      parameters: schema.input._def,
    }));

    return c.json({
      version: "1.0.0",
      tools,
    });
  });

  // GET /api/v1/skills.md - Detailed usage guide for AI agents
  api.get("/skills.md", async (c) => {
    const skillsDoc = await getStaticDoc("skills.md");
    return c.text(skillsDoc, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    });
  });

  // POST /api/v1/invoke - Call any tool by name
  api.post(
    "/invoke",
    async (c) => {
      const jsonBody = await c.req.json().catch(() => null);
      const invokeParse = invokeSchema.safeParse(jsonBody);
      if (!invokeParse.success) {
        return c.json(
          {
            error: "Invalid input",
            details: invokeParse.error.issues,
          },
          400
        );
      }

      const userId = await authenticateRequest(c);
      if (!userId) {
        return c.json({ error: "Unauthorized. Provide x-api-key header or valid session." }, 401);
      }

      const { tool, input } = invokeParse.data;

      if (!(tool in toolHandlers)) {
        return c.json(
          {
            error: `Unknown tool: ${tool}`,
            availableTools: Object.keys(toolSchemas),
          },
          400
        );
      }

      const toolName = tool as ToolName;
      const schema = toolSchemas[toolName];

      // Validate input against schema
      const parseResult = schema.input.safeParse(input);
      if (!parseResult.success) {
        return c.json(
          {
            error: "Invalid input",
            details: parseResult.error.issues,
          },
          400
        );
      }

      try {
        const result = await toolHandlers[toolName](userId, parseResult.data);
        return c.json({ success: true, result });
      } catch (error) {
        if (error instanceof ApiError) {
          return c.json({ error: error.message }, error.status);
        }
        if (error instanceof RtmApiError) {
          if (error.isInvalidToken()) {
            return c.json(
              { error: "RTM token is invalid. Please reconnect your account." },
              401
            );
          }
          return c.json({ error: error.message }, 400);
        }
        console.error("API error:", error);
        return c.json({ error: "Internal server error" }, 500);
      }
    }
  );

  return api;
}
