import { request } from "undici";
import { apiSig } from "./sign.js";
import { RateLimiter } from "./util/limiter.js";
const API_BASE = "https://api.rememberthemilk.com/services/rest/";
const AUTH_BASE = "https://www.rememberthemilk.com/services/auth/";
// Always use API v2 for full feature support
const API_VERSION = "2";
export class RtmClient {
    apiKey;
    sharedSecret;
    limiter;
    constructor(apiKey, sharedSecret) {
        this.apiKey = apiKey;
        this.sharedSecret = sharedSecret;
        // RTM allows ~1 req/sec per user, we use 500ms between requests to be safe
        this.limiter = new RateLimiter(500);
    }
    /**
     * Make an authenticated API call to RTM
     */
    async call(method, params = {}, authToken) {
        await this.limiter.wait();
        const baseParams = {
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
            const data = (await body.json());
            // Handle RTM API errors
            if (data.rsp.stat === "fail") {
                const error = data.rsp.err;
                throw new RtmApiError(error?.code || "UNKNOWN", error?.msg || "Unknown RTM API error", statusCode);
            }
            return data;
        }
        catch (error) {
            if (error instanceof RtmApiError)
                throw error;
            // Handle network/HTTP errors
            throw new RtmApiError("NETWORK_ERROR", `Failed to call RTM API: ${error}`, 0);
        }
    }
    /**
     * Generate authentication URL for user to authorize
     */
    authUrl(perms = "write") {
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
    async getToken(frob) {
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
    async checkToken(authToken) {
        try {
            await this.call("rtm.auth.checkToken", {}, authToken);
            return true;
        }
        catch (error) {
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
    async createTimeline(authToken) {
        const data = await this.call("rtm.timelines.create", {}, authToken);
        return data.rsp.timeline;
    }
    /**
     * Get user's lists
     */
    async getLists(authToken) {
        const data = await this.call("rtm.lists.getList", {}, authToken);
        return data.rsp.lists;
    }
    /**
     * Get tasks from a list
     */
    async getTasks(authToken, listId, filter) {
        const params = {};
        if (listId)
            params.list_id = listId;
        if (filter)
            params.filter = filter;
        const data = await this.call("rtm.tasks.getList", params, authToken);
        return data.rsp.tasks;
    }
    /**
     * Add a new task
     */
    async addTask(authToken, timeline, name, listId, parse) {
        const params = {
            timeline,
            name,
        };
        if (listId)
            params.list_id = listId;
        if (parse !== undefined)
            params.parse = parse ? "1" : "0";
        const data = await this.call("rtm.tasks.add", params, authToken);
        return data.rsp.list;
    }
    /**
     * Complete a task
     */
    async completeTask(authToken, timeline, listId, taskseriesId, taskId) {
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
    async setPriority(authToken, timeline, listId, taskseriesId, taskId, priority) {
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
    async getWebhookTopics(authToken) {
        // Stubbed - will be implemented later
        return [];
    }
    /**
     * Subscribe to webhooks (stubbed for now)
     */
    async subscribeWebhook(authToken, url, topics, filter, leaseSeconds) {
        // Stubbed - will be implemented later
        return { subscription_id: "stub" };
    }
    /**
     * Get active webhook subscriptions (stubbed for now)
     */
    async getWebhookSubscriptions(authToken) {
        // Stubbed - will be implemented later
        return [];
    }
    /**
     * Unsubscribe from webhooks (stubbed for now)
     */
    async unsubscribeWebhook(authToken, subscriptionId) {
        // Stubbed - will be implemented later
    }
}
// Custom error class for RTM API errors
export class RtmApiError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = "RtmApiError";
    }
    // Check if error is due to invalid token
    isInvalidToken() {
        return this.code === "98" || this.code === "99";
    }
    // Check if error is temporary (rate limit, service unavailable)
    isTemporary() {
        return (this.code === "105" || // Service unavailable
            this.statusCode === 503 ||
            this.statusCode === 429);
    }
}
// Singleton instance
let rtmClientInstance = null;
export function getRtmClient() {
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
