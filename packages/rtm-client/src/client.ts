import { request } from "undici";
import { apiSig } from "./sign.js";
import type { RtmApiResponse, RtmTimeline, RtmAuthToken } from "./types";
import { RateLimiter } from "./util/limiter.js";

const API_BASE = "https://api.rememberthemilk.com/services/rest/";
const AUTH_BASE = "https://www.rememberthemilk.com/services/auth/";

// Always use API v2 for full feature support
const API_VERSION = "2";

export class RtmClient {
  private apiKey: string;
  private sharedSecret: string;
  private limiter: RateLimiter;

  constructor(apiKey: string, sharedSecret: string) {
    this.apiKey = apiKey;
    this.sharedSecret = sharedSecret;
    // RTM allows ~1 req/sec per user, we use 500ms between requests to be safe
    this.limiter = new RateLimiter(500);
  }

  /**
   * Make an authenticated API call to RTM
   */
  async call(
    method: string,
    params: Record<string, any> = {},
    authToken?: string
  ): Promise<RtmApiResponse> {
    await this.limiter.wait();

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
      const { body, statusCode } = await request(`${API_BASE}?${qs}`, {
        method: "GET",
        headers: { "User-Agent": "MCP-RTM/1.0" },
      });

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

  /**
   * Generate authentication URL for user to authorize
   */
  authUrl(perms: "read" | "write" | "delete" = "write"): string {
    const params = {
      api_key: this.apiKey,
      perms,
    };
    const sig = apiSig(params, this.sharedSecret);
    const qs = new URLSearchParams({ ...params, api_sig: sig }).toString();
    return `${AUTH_BASE}?${qs}`;
  }

  /**
   * Exchange frob for auth token
   */
  async getToken(frob: string): Promise<{ auth: RtmAuthToken }> {
    const data = await this.call("rtm.auth.getToken", { frob });
    return {
      auth: {
        token: data.rsp.auth.token,
        perms: data.rsp.auth.perms,
        user: {
          id: data.rsp.auth.user.id,
          username: data.rsp.auth.user.username,
          fullname: data.rsp.auth.user.fullname,
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
        // Login failed / Invalid auth token
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a new timeline for this session
   * Timelines should be created per-session, not stored permanently
   */
  async createTimeline(authToken: string): Promise<string> {
    const data = await this.call("rtm.timelines.create", {}, authToken);
    return data.rsp.timeline;
  }

  /**
   * Get user's lists
   */
  async getLists(authToken: string): Promise<any> {
    const data = await this.call("rtm.lists.getList", {}, authToken);
    return data.rsp.lists;
  }

  /**
   * Get tasks from a list
   */
  async getTasks(
    authToken: string,
    listId?: string,
    filter?: string
  ): Promise<any> {
    const params: Record<string, any> = {};
    if (listId) params.list_id = listId;
    if (filter) params.filter = filter;

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
  ): Promise<any> {
    const params: Record<string, any> = {
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
  ): Promise<any> {
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
   * Set task priority
   */
  async setPriority(
    authToken: string,
    timeline: string,
    listId: string,
    taskseriesId: string,
    taskId: string,
    priority: "1" | "2" | "3" | "N"
  ): Promise<any> {
    const params = {
      timeline,
      list_id: listId,
      taskseries_id: taskseriesId,
      task_id: taskId,
      priority,
    };

    const data = await this.call("rtm.tasks.setPriority", params, authToken);
    return data.rsp.list;
  }

  /**
   * Get available webhook topics (stubbed for now)
   */
  async getWebhookTopics(authToken: string): Promise<string[]> {
    // Stubbed - will be implemented later
    return [];
  }

  /**
   * Subscribe to webhooks (stubbed for now)
   */
  async subscribeWebhook(
    authToken: string,
    url: string,
    topics: string[],
    filter?: string,
    leaseSeconds?: number
  ): Promise<any> {
    // Stubbed - will be implemented later
    return { subscription_id: "stub" };
  }

  /**
   * Get active webhook subscriptions (stubbed for now)
   */
  async getWebhookSubscriptions(authToken: string): Promise<any[]> {
    // Stubbed - will be implemented later
    return [];
  }

  /**
   * Unsubscribe from webhooks (stubbed for now)
   */
  async unsubscribeWebhook(
    authToken: string,
    subscriptionId: string
  ): Promise<void> {
    // Stubbed - will be implemented later
  }
}

// Custom error class for RTM API errors
export class RtmApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "RtmApiError";
  }

  // Check if error is due to invalid token
  isInvalidToken(): boolean {
    return this.code === "98" || this.code === "99";
  }

  // Check if error is temporary (rate limit, service unavailable)
  isTemporary(): boolean {
    return (
      this.code === "105" || // Service unavailable
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
