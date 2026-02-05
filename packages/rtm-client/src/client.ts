import Bottleneck from "bottleneck";
import { request } from "undici";
import { apiSig } from "./sign.js";
import type { RtmApiResponse, RtmAuthToken } from "./types";

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

  /**
   * Get a frob for desktop-style authentication (no callback URL needed)
   */
  async getFrob(): Promise<string> {
    const data = await this.call("rtm.auth.getFrob");
    return data.rsp.frob as string;
  }

  /**
   * Generate authentication URL for user to authorize
   *
   * @param perms - Permission level (read, write, or delete)
   * @param frob - Optional frob for desktop flow. If provided, uses desktop flow (no callback).
   *               If omitted, uses web flow (requires callback URL configured at RTM).
   */
  authUrl(perms: "read" | "write" | "delete" = "write", frob?: string): string {
    const params: Record<string, string> = {
      api_key: this.apiKey,
      perms,
    };

    if (frob) {
      // Desktop flow - include frob in URL
      params.frob = frob;
    }
    // Web flow - RTM will redirect to configured callback URL with frob

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
        // Login failed / Invalid auth token
        return false;
      }
      throw error;
    }
  }

  /**
   * Test if user is logged in (alternative to checkToken)
   * Returns user info if logged in, throws error if not
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
        // Login failed / Invalid auth token / User not logged in
        return null;
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
    return data.rsp.timeline as string;
  }

  /**
   * Get user's lists
   */
  async getLists(authToken: string): Promise<unknown> {
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
  ): Promise<unknown> {
    const params: Record<string, unknown> = {};
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
   * Get available webhook topics (stubbed for now)
   */
  async getWebhookTopics(_authToken: string): Promise<string[]> {
    // Stubbed - will be implemented later
    return [];
  }

  /**
   * Subscribe to webhooks (stubbed for now)
   */
  async subscribeWebhook(
    _authToken: string,
    _url: string,
    _topics: string[],
    _filter?: string,
    _leaseSeconds?: number
  ): Promise<unknown> {
    // Stubbed - will be implemented later
    return { subscription_id: "stub" };
  }

  /**
   * Get active webhook subscriptions (stubbed for now)
   */
  async getWebhookSubscriptions(_authToken: string): Promise<unknown[]> {
    // Stubbed - will be implemented later
    return [];
  }

  /**
   * Unsubscribe from webhooks (stubbed for now)
   */
  async unsubscribeWebhook(
    _authToken: string,
    _subscriptionId: string
  ): Promise<void> {
    // Stubbed - will be implemented later
  }
}

// Custom error class for RTM API errors
export class RtmApiError extends Error {
  constructor(public code: string, message: string, public statusCode: number) {
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
