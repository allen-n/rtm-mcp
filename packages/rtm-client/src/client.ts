import Bottleneck from "bottleneck";
import { request } from "undici";
import { apiSig } from "./sign.js";
import type { RtmApiResponse, RtmAuthToken, RtmList, RtmTask, RtmTag, RtmLocation, RtmNote } from "./types.js";

const API_BASE = "https://api.rememberthemilk.com/services/rest/";
const AUTH_BASE = "https://www.rememberthemilk.com/services/auth/";

// Always use API v2 for full feature support
const API_VERSION = "2";

export class RtmClient {
  private apiKey: string;
  private sharedSecret: string;
  private limiter: Bottleneck;

  constructor(apiKey: string, sharedSecret: string) {
    this.apiKey = apiKey;
    this.sharedSecret = sharedSecret;
    // RTM allows ~1 req/sec per user, we use 800ms between requests to be safe
    this.limiter = new Bottleneck({ maxConcurrent: 1, minTime: 800 });
  }

  /**
   * Make an authenticated API call to RTM
   */
  async call(
    method: string,
    params: Record<string, unknown> = {},
    authToken?: string
  ): Promise<RtmApiResponse> {
    const baseParams: Record<string, string> = {
      method,
      api_key: this.apiKey,
      format: "json",
      v: API_VERSION,
    };

    if (authToken) {
      baseParams.auth_token = authToken;
    }

    // Merge and convert all params to strings
    const allParams = { ...baseParams };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        allParams[key] = String(value);
      }
    }

    // Generate signature
    allParams.api_sig = apiSig(allParams, this.sharedSecret);

    // Build query string
    const qs = new URLSearchParams(allParams).toString();

    try {
      const { body, statusCode } = await this.limiter.schedule(() =>
        request(`${API_BASE}?${qs}`, {
          method: "GET",
          headers: { "User-Agent": "MCP-RTM/1.0" },
        })
      );

      const data = (await body.json()) as RtmApiResponse;

      // Handle RTM API errors
      if (data.rsp.stat === "fail") {
        const error = data.rsp.err;
        throw new RtmApiError(
          error?.code || "UNKNOWN",
          error?.msg || "Unknown RTM API error",
          statusCode
        );
      }

      return data;
    } catch (error) {
      if (error instanceof RtmApiError) throw error;

      // Handle network/HTTP errors
      throw new RtmApiError(
        "NETWORK_ERROR",
        `Failed to call RTM API: ${error}`,
        0
      );
    }
  }

  // ============================================
  // AUTH METHODS
  // ============================================

  /**
   * Get a frob for desktop-style authentication (no callback URL needed)
   */
  async getFrob(): Promise<string> {
    const data = await this.call("rtm.auth.getFrob");
    return data.rsp.frob as string;
  }

  /**
   * Generate authentication URL for user to authorize
   */
  authUrl(perms: "read" | "write" | "delete" = "write", frob?: string): string {
    const params: Record<string, string> = {
      api_key: this.apiKey,
      perms,
    };

    if (frob) {
      params.frob = frob;
    }

    const sig = apiSig(params, this.sharedSecret);
    const qs = new URLSearchParams({ ...params, api_sig: sig }).toString();
    return `${AUTH_BASE}?${qs}`;
  }

  /**
   * Exchange frob for auth token
   */
  async getToken(frob: string): Promise<{ auth: RtmAuthToken }> {
    const data = await this.call("rtm.auth.getToken", { frob });
    const auth = data.rsp.auth as RtmAuthToken;
    return {
      auth: {
        token: auth.token,
        perms: auth.perms,
        user: {
          id: auth.user.id,
          username: auth.user.username,
          fullname: auth.user.fullname,
        },
      },
    };
  }

  /**
   * Verify auth token is still valid
   */
  async checkToken(authToken: string): Promise<boolean> {
    try {
      await this.call("rtm.auth.checkToken", {}, authToken);
      return true;
    } catch (error) {
      if (error instanceof RtmApiError && error.code === "98") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Test if user is logged in
   */
  async testLogin(
    authToken: string
  ): Promise<{ id: string; username: string } | null> {
    try {
      const data = await this.call("rtm.test.login", {}, authToken);
      const user = data.rsp.user as { id: string; username: string };
      return user;
    } catch (error) {
      if (
        error instanceof RtmApiError &&
        (error.code === "98" || error.code === "99")
      ) {
        return null;
      }
      throw error;
    }
  }

  // ============================================
  // TIMELINE METHODS
  // ============================================

  /**
   * Create a new timeline for this session
   */
  async createTimeline(authToken: string): Promise<string> {
    const data = await this.call("rtm.timelines.create", {}, authToken);
    return data.rsp.timeline as string;
  }

  // ============================================
  // LISTS METHODS
  // ============================================

  /**
   * Get user's lists
   */
  async getLists(authToken: string): Promise<{ list: RtmList[] }> {
    const data = await this.call("rtm.lists.getList", {}, authToken);
    return data.rsp.lists as { list: RtmList[] };
  }

  /**
   * Create a new list
   */
  async addList(
    authToken: string,
    timeline: string,
    name: string,
    filter?: string
  ): Promise<RtmList> {
    const params: Record<string, unknown> = { timeline, name };
    if (filter) params.filter = filter;

    const data = await this.call("rtm.lists.add", params, authToken);
    return data.rsp.list as RtmList;
  }

  /**
   * Delete a list
   */
  async deleteList(
    authToken: string,
    timeline: string,
    listId: string
  ): Promise<RtmList> {
    const data = await this.call(
      "rtm.lists.delete",
      { timeline, list_id: listId },
      authToken
    );
    return data.rsp.list as RtmList;
  }

  /**
   * Archive a list
   */
  async archiveList(
    authToken: string,
    timeline: string,
    listId: string
  ): Promise<RtmList> {
    const data = await this.call(
      "rtm.lists.archive",
      { timeline, list_id: listId },
      authToken
    );
    return data.rsp.list as RtmList;
  }

  /**
   * Unarchive a list
   */
  async unarchiveList(
    authToken: string,
    timeline: string,
    listId: string
  ): Promise<RtmList> {
    const data = await this.call(
      "rtm.lists.unarchive",
      { timeline, list_id: listId },
      authToken
    );
    return data.rsp.list as RtmList;
  }

  /**
   * Rename a list
   */
  async setListName(
    authToken: string,
    timeline: string,
    listId: string,
    name: string
  ): Promise<RtmList> {
    const data = await this.call(
      "rtm.lists.setName",
      { timeline, list_id: listId, name },
      authToken
    );
    return data.rsp.list as RtmList;
  }

  /**
   * Set the default list
   */
  async setDefaultList(
    authToken: string,
    timeline: string,
    listId: string
  ): Promise<void> {
    await this.call(
      "rtm.lists.setDefaultList",
      { timeline, list_id: listId },
      authToken
    );
  }

  // ============================================
  // TASKS METHODS
  // ============================================

  /**
   * Get tasks from a list
   */
  async getTasks(
    authToken: string,
    listId?: string,
    filter?: string,
    lastSync?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {};
    if (listId) params.list_id = listId;
    if (filter) params.filter = filter;
    if (lastSync) params.last_sync = lastSync;

    const data = await this.call("rtm.tasks.getList", params, authToken);
    return data.rsp.tasks;
  }

  /**
   * Add a new task
   */
  async addTask(
    authToken: string,
    timeline: string,
    name: string,
    listId?: string,
    parse?: boolean
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      name,
    };
    if (listId) params.list_id = listId;
    if (parse !== undefined) params.parse = parse ? "1" : "0";

    const data = await this.call("rtm.tasks.add", params, authToken);
    return data.rsp.list;
  }

  /**
   * Complete a task
   */
  async completeTask(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };

    const data = await this.call("rtm.tasks.complete", params, authToken);
    return data.rsp.list;
  }

  /**
   * Uncomplete a task (mark as not done)
   */
  async uncompleteTask(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };

    const data = await this.call("rtm.tasks.uncomplete", params, authToken);
    return data.rsp.list;
  }

  /**
   * Delete a task
   */
  async deleteTask(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };

    const data = await this.call("rtm.tasks.delete", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task priority
   */
  async setPriority(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    priority: "1" | "2" | "3" | "N"
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      priority,
    } satisfies Record<string, string>;

    const data = await this.call("rtm.tasks.setPriority", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task due date
   */
  async setDueDate(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    due?: string,
    hasDueTime?: boolean,
    parse?: boolean
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (due) params.due = due;
    if (hasDueTime !== undefined) params.has_due_time = hasDueTime ? "1" : "0";
    if (parse !== undefined) params.parse = parse ? "1" : "0";

    const data = await this.call("rtm.tasks.setDueDate", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task start date
   */
  async setStartDate(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    start?: string,
    hasStartTime?: boolean,
    parse?: boolean
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (start) params.start = start;
    if (hasStartTime !== undefined) params.has_start_time = hasStartTime ? "1" : "0";
    if (parse !== undefined) params.parse = parse ? "1" : "0";

    const data = await this.call("rtm.tasks.setStartDate", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task name
   */
  async setTaskName(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    name: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      name,
    };

    const data = await this.call("rtm.tasks.setName", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task recurrence
   */
  async setRecurrence(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    repeat?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (repeat) params.repeat = repeat;

    const data = await this.call("rtm.tasks.setRecurrence", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task estimate
   */
  async setEstimate(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    estimate?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (estimate) params.estimate = estimate;

    const data = await this.call("rtm.tasks.setEstimate", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task URL
   */
  async setUrl(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    url?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (url) params.url = url;

    const data = await this.call("rtm.tasks.setURL", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task location
   */
  async setLocation(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    locationId?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (locationId) params.location_id = locationId;

    const data = await this.call("rtm.tasks.setLocation", params, authToken);
    return data.rsp.list;
  }

  /**
   * Postpone a task (move due date forward by one day)
   */
  async postponeTask(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };

    const data = await this.call("rtm.tasks.postpone", params, authToken);
    return data.rsp.list;
  }

  /**
   * Move task to a different list
   */
  async moveTask(
    authToken: string,
    timeline: string,
    fromListId: string,
    toListId: string,
    taskseriesId: string,
    taskId: string
  ): Promise<unknown> {
    const params = {
      timeline,
      from_list_id: fromListId,
      to_list_id: toListId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };

    const data = await this.call("rtm.tasks.moveTo", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set task parent (for subtasks)
   */
  async setParentTask(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    parentTaskId?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
    };
    if (parentTaskId) params.parent_task_id = parentTaskId;

    const data = await this.call("rtm.tasks.setParentTask", params, authToken);
    return data.rsp.list;
  }

  // ============================================
  // TAGS METHODS
  // ============================================

  /**
   * Get all tags
   */
  async getTags(authToken: string): Promise<{ tag: RtmTag[] }> {
    const data = await this.call("rtm.tags.getList", {}, authToken);
    return data.rsp.tags as { tag: RtmTag[] };
  }

  /**
   * Add tags to a task
   */
  async addTags(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    tags: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      tags,
    };

    const data = await this.call("rtm.tasks.addTags", params, authToken);
    return data.rsp.list;
  }

  /**
   * Remove tags from a task
   */
  async removeTags(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    tags: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      tags,
    };

    const data = await this.call("rtm.tasks.removeTags", params, authToken);
    return data.rsp.list;
  }

  /**
   * Set tags for a task (replaces existing tags)
   */
  async setTags(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    tags: string
  ): Promise<unknown> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      tags,
    };

    const data = await this.call("rtm.tasks.setTags", params, authToken);
    return data.rsp.list;
  }

  // ============================================
  // NOTES METHODS
  // ============================================

  /**
   * Add a note to a task
   */
  async addNote(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    noteTitle: string,
    noteText: string
  ): Promise<RtmNote> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      note_title: noteTitle,
      note_text: noteText,
    };

    const data = await this.call("rtm.tasks.notes.add", params, authToken);
    return data.rsp.note as RtmNote;
  }

  /**
   * Edit a note
   */
  async editNote(
    authToken: string,
    timeline: string,
    noteId: string,
    noteTitle: string,
    noteText: string
  ): Promise<RtmNote> {
    const params = {
      timeline,
      note_id: noteId,
      note_title: noteTitle,
      note_text: noteText,
    };

    const data = await this.call("rtm.tasks.notes.edit", params, authToken);
    return data.rsp.note as RtmNote;
  }

  /**
   * Delete a note
   */
  async deleteNote(
    authToken: string,
    timeline: string,
    noteId: string
  ): Promise<void> {
    const params = {
      timeline,
      note_id: noteId,
    };

    await this.call("rtm.tasks.notes.delete", params, authToken);
  }

  // ============================================
  // LOCATIONS METHODS
  // ============================================

  /**
   * Get all locations
   */
  async getLocations(authToken: string): Promise<{ location: RtmLocation[] }> {
    const data = await this.call("rtm.locations.getList", {}, authToken);
    return data.rsp.locations as { location: RtmLocation[] };
  }

  // ============================================
  // SETTINGS METHODS
  // ============================================

  /**
   * Get user settings
   */
  async getSettings(authToken: string): Promise<unknown> {
    const data = await this.call("rtm.settings.getList", {}, authToken);
    return data.rsp.settings;
  }

  // ============================================
  // TIMEZONES METHODS
  // ============================================

  /**
   * Get list of timezones
   */
  async getTimezones(): Promise<unknown> {
    const data = await this.call("rtm.timezones.getList");
    return data.rsp.timezones;
  }

  // ============================================
  // TIME METHODS
  // ============================================

  /**
   * Parse a date/time string
   */
  async parseTime(
    authToken: string,
    text: string,
    timezone?: string,
    dateFormat?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = { text };
    if (timezone) params.timezone = timezone;
    if (dateFormat) params.dateformat = dateFormat;

    const data = await this.call("rtm.time.parse", params, authToken);
    return data.rsp.time;
  }

  /**
   * Convert time between timezones
   */
  async convertTime(
    toTimezone: string,
    fromTimezone?: string,
    time?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = { to_timezone: toTimezone };
    if (fromTimezone) params.from_timezone = fromTimezone;
    if (time) params.time = time;

    const data = await this.call("rtm.time.convert", params);
    return data.rsp.time;
  }

  // ============================================
  // TRANSACTIONS METHODS
  // ============================================

  /**
   * Undo a transaction
   */
  async undoTransaction(
    authToken: string,
    timeline: string,
    transactionId: string
  ): Promise<void> {
    const params = {
      timeline,
      transaction_id: transactionId,
    };

    await this.call("rtm.transactions.undo", params, authToken);
  }

  // ============================================
  // PUSH/WEBHOOK METHODS
  // ============================================

  /**
   * Get available push topics
   */
  async getPushTopics(authToken: string): Promise<unknown> {
    const data = await this.call("rtm.push.getTopics", {}, authToken);
    return data.rsp.topics;
  }

  /**
   * Get active push subscriptions
   */
  async getPushSubscriptions(authToken: string): Promise<unknown> {
    const data = await this.call("rtm.push.getSubscriptions", {}, authToken);
    return data.rsp.subscriptions;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribePush(
    authToken: string,
    url: string,
    topics: string,
    leaseSeconds?: number,
    filter?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      url,
      topics,
    };
    if (leaseSeconds) params.lease_seconds = leaseSeconds;
    if (filter) params.filter = filter;

    const data = await this.call("rtm.push.subscribe", params, authToken);
    return data.rsp.subscription;
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush(
    authToken: string,
    subscriptionId: string
  ): Promise<void> {
    await this.call(
      "rtm.push.unsubscribe",
      { subscription_id: subscriptionId },
      authToken
    );
  }

  // ============================================
  // CONTACTS METHODS
  // ============================================

  /**
   * Get contacts list
   */
  async getContacts(authToken: string): Promise<unknown> {
    const data = await this.call("rtm.contacts.getList", {}, authToken);
    return data.rsp.contacts;
  }

  /**
   * Add a contact
   */
  async addContact(
    authToken: string,
    timeline: string,
    contact: string
  ): Promise<unknown> {
    const params = { timeline, contact };
    const data = await this.call("rtm.contacts.add", params, authToken);
    return data.rsp.contact;
  }

  /**
   * Delete a contact
   */
  async deleteContact(
    authToken: string,
    timeline: string,
    contactId: string
  ): Promise<void> {
    await this.call(
      "rtm.contacts.delete",
      { timeline, contact_id: contactId },
      authToken
    );
  }
}

// Custom error class for RTM API errors
export class RtmApiError extends Error {
  constructor(public code: string, message: string, public statusCode: number) {
    super(message);
    this.name = "RtmApiError";
  }

  isInvalidToken(): boolean {
    return this.code === "98" || this.code === "99";
  }

  isTemporary(): boolean {
    return (
      this.code === "105" ||
      this.statusCode === 503 ||
      this.statusCode === 429
    );
  }
}

// Singleton instance
let rtmClientInstance: RtmClient | null = null;

export function getRtmClient(): RtmClient {
  if (!rtmClientInstance) {
    const apiKey = process.env.RTM_API_KEY;
    const sharedSecret = process.env.RTM_SHARED_SECRET;

    if (!apiKey || !sharedSecret) {
      throw new Error("RTM_API_KEY and RTM_SHARED_SECRET must be set");
    }

    rtmClientInstance = new RtmClient(apiKey, sharedSecret);
  }

  return rtmClientInstance;
}
