import {
  isInitializeRequest,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessageSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HTTPException } from "hono/http-exception";
import { SSEStreamingApi } from "hono/streaming";

const isOldBunVersion = (() => {
  let cached: boolean | null = null;
  return () => {
    if (cached !== null) return cached;
    const bunVersion = (globalThis as any)?.Bun?.version as
      | string
      | undefined;
    if (!bunVersion) {
      cached = false;
      return cached;
    }
    cached =
      bunVersion.startsWith("1.1") ||
      bunVersion.startsWith("1.0") ||
      bunVersion.startsWith("0.");
    return cached;
  };
})();

const run = async (
  stream: SSEStreamingApi,
  cb: (stream: SSEStreamingApi) => Promise<void>,
  onError?: (err: Error, stream: SSEStreamingApi) => Promise<void>
) => {
  try {
    await cb(stream);
  } catch (e) {
    if (e instanceof Error && onError) {
      await onError(e, stream);
      await stream.writeSSE({
        event: "error",
        data: e.message,
      });
    } else {
      console.error(e);
    }
  }
};

const contextStash = new WeakMap<ReadableStream, any>();

const streamSSE = (
  c: any,
  cb: (stream: SSEStreamingApi) => Promise<void>,
  onError?: (err: Error, stream: SSEStreamingApi) => Promise<void>
) => {
  const { readable, writable } = new TransformStream();
  const stream = new SSEStreamingApi(writable, readable);

  if (isOldBunVersion()) {
    c.req.raw.signal.addEventListener("abort", () => {
      if (!stream.closed) {
        stream.abort();
      }
    });
  }

  contextStash.set(stream.responseReadable, c);

  c.header("Transfer-Encoding", "chunked");
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  run(stream, cb, onError);
  return c.newResponse(stream.responseReadable);
};

export class RelaxedStreamableHTTPTransport {
  #started = false;
  #initialized = false;
  #onsessioninitialized?: (sessionId: string) => void;
  #sessionIdGenerator?: () => string;
  #eventStore?: any;
  #enableJsonResponse = false;
  #standaloneSseStreamId = "_GET_stream";
  #streamMapping = new Map<string, any>();
  #requestToStreamMapping = new Map<string | number, string>();
  #requestResponseMap = new Map<string | number, any>();

  sessionId?: string;
  onclose?: () => void;
  onerror?: (err: Error) => void;
  onmessage?: (message: any, options?: { authInfo?: any }) => void;

  constructor(options?: {
    sessionIdGenerator?: () => string;
    eventStore?: any;
    enableJsonResponse?: boolean;
    onsessioninitialized?: (sessionId: string) => void;
  }) {
    this.#sessionIdGenerator = options?.sessionIdGenerator;
    this.#enableJsonResponse = options?.enableJsonResponse ?? false;
    this.#eventStore = options?.eventStore;
    this.#onsessioninitialized = options?.onsessioninitialized;
  }

  async start() {
    if (this.#started) {
      throw new Error("Transport already started");
    }
    this.#started = true;
  }

  async handleRequest(ctx: any, parsedBody?: any) {
    switch (ctx.req.method) {
      case "GET":
        return this.handleGetRequest(ctx);
      case "POST":
        return this.handlePostRequest(ctx, parsedBody);
      case "DELETE":
        return this.handleDeleteRequest(ctx);
      default:
        return this.handleUnsupportedRequest(ctx);
    }
  }

  async handleGetRequest(ctx: any) {
    try {
      const acceptHeader = ctx.req.header("Accept");
      if (!acceptHeader?.includes("text/event-stream")) {
        throw new HTTPException(406, {
          res: Response.json({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message: "Not Acceptable: Client must accept text/event-stream",
            },
            id: null,
          }),
        });
      }

      this.validateSession(ctx);

      if (this.sessionId !== undefined) {
        ctx.header("mcp-session-id", this.sessionId);
      }

      let streamId: string | ((stream: SSEStreamingApi) => Promise<void>) =
        this.#standaloneSseStreamId;

      if (this.#eventStore) {
        const lastEventId = ctx.req.header("last-event-id");
        if (lastEventId) {
          streamId = (stream) =>
            this.#eventStore.replayEventsAfter(lastEventId, {
              send: async (eventId: string, message: any) => {
                try {
                  await stream.writeSSE({
                    id: eventId,
                    event: "message",
                    data: JSON.stringify(message),
                  });
                } catch {
                  this.onerror?.(new Error("Failed replay events"));
                  throw new HTTPException(500, {
                    message: "Failed replay events",
                  });
                }
              },
            });
        }
      }

      if (
        typeof streamId === "string" &&
        this.#streamMapping.get(streamId) !== undefined
      ) {
        throw new HTTPException(409, {
          res: Response.json({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message: "Conflict: Only one SSE stream is allowed per session",
            },
            id: null,
          }),
        });
      }

      return streamSSE(ctx, async (stream) => {
        if (typeof streamId === "function") {
          await streamId(stream);
        }

        if (typeof streamId === "string") {
          this.#streamMapping.set(streamId, {
            ctx: { header: ctx.header },
            stream,
            cleanup: () => {
              this.#streamMapping.delete(streamId);
            },
          });
        }

        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            if (typeof streamId === "string") {
              this.#streamMapping.get(streamId)?.cleanup();
            }
            resolve();
          });
        });
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      this.onerror?.(error as Error);
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: String(error),
          },
          id: null,
        }),
      });
    }
  }

  async handlePostRequest(ctx: any, parsedBody?: any) {
    try {
      const acceptHeader = ctx.req.header("Accept") ?? "";
      const acceptsJson =
        acceptHeader.includes("application/json") ||
        acceptHeader.includes("*/*") ||
        acceptHeader === "";
      const acceptsSse = acceptHeader.includes("text/event-stream");

      if (!acceptsJson || (!acceptsSse && !this.#enableJsonResponse)) {
        throw new HTTPException(406, {
          res: Response.json({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message:
                "Not Acceptable: Client must accept application/json (and text/event-stream for SSE)",
            },
            id: null,
          }),
        });
      }

      const ct = ctx.req.header("Content-Type");
      if (!ct?.includes("application/json")) {
        throw new HTTPException(415, {
          res: Response.json({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message: "Unsupported Media Type: Content-Type must be application/json",
            },
            id: null,
          }),
        });
      }

      const authInfo = ctx.get("auth");
      let rawMessage = parsedBody;
      if (rawMessage === undefined) {
        rawMessage = await ctx.req.json();
      }

      const messages = Array.isArray(rawMessage)
        ? rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg))
        : [JSONRPCMessageSchema.parse(rawMessage)];

      const isInitializationRequest = messages.some(isInitializeRequest);
      if (isInitializationRequest) {
        if (this.#initialized && this.sessionId !== undefined) {
          throw new HTTPException(400, {
            res: Response.json({
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request: Server already initialized",
              },
              id: null,
            }),
          });
        }
        if (messages.length > 1) {
          throw new HTTPException(400, {
            res: Response.json({
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request: Only one initialization request is allowed",
              },
              id: null,
            }),
          });
        }
        this.sessionId = this.#sessionIdGenerator?.();
        this.#initialized = true;
        if (this.sessionId && this.#onsessioninitialized) {
          this.#onsessioninitialized(this.sessionId);
        }
      }

      if (!isInitializationRequest) {
        this.validateSession(ctx);
      }

      const hasRequests = messages.some(isJSONRPCRequest);
      if (!hasRequests) {
        for (const message of messages) {
          this.onmessage?.(message, { authInfo });
        }
        return ctx.body(null, 202);
      }

      if (hasRequests) {
        const streamId = crypto.randomUUID();
        if (!this.#enableJsonResponse && this.sessionId !== undefined) {
          ctx.header("mcp-session-id", this.sessionId);
        }

        if (this.#enableJsonResponse) {
          const result = await new Promise<Response>((resolve) => {
            for (const message of messages) {
              if (isJSONRPCRequest(message)) {
                this.#streamMapping.set(streamId, {
                  ctx: {
                    header: ctx.header,
                    json: (data: any) => {
                      resolve(ctx.json(data));
                    },
                  },
                  cleanup: () => {
                    this.#streamMapping.delete(streamId);
                  },
                });
                this.#requestToStreamMapping.set(message.id, streamId);
              }
            }
            for (const message of messages) {
              this.onmessage?.(message, { authInfo });
            }
          });
          return result;
        }

        return streamSSE(ctx, async (stream) => {
          for (const message of messages) {
            if (isJSONRPCRequest(message)) {
              this.#streamMapping.set(streamId, {
                ctx: { header: ctx.header },
                stream,
                cleanup: () => {
                  this.#streamMapping.delete(streamId);
                },
              });
              this.#requestToStreamMapping.set(message.id, streamId);
            }
          }
          for (const message of messages) {
            this.onmessage?.(message, { authInfo });
          }
          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              this.#streamMapping.get(streamId)?.cleanup();
              resolve();
            });
          });
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      this.onerror?.(error as Error);
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: String(error),
          },
          id: null,
        }),
      });
    }
  }

  async handleDeleteRequest(ctx: any) {
    this.validateSession(ctx);
    await this.close();
    return ctx.body(null, 200);
  }

  handleUnsupportedRequest(ctx: any) {
    return ctx.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "Method not allowed.",
        },
        id: null,
      },
      {
        status: 405,
        headers: {
          Allow: "GET, POST, DELETE",
        },
      }
    );
  }

  validateSession(ctx: any) {
    if (this.#sessionIdGenerator === undefined) {
      return true;
    }
    if (!this.#initialized) {
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Server not initialized",
          },
          id: null,
        }),
      });
    }
    const sessionId = ctx.req.header("mcp-session-id");
    if (!sessionId) {
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Mcp-Session-Id header is required",
          },
          id: null,
        }),
      });
    }
    if (Array.isArray(sessionId)) {
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Mcp-Session-Id header must be a single value",
          },
          id: null,
        }),
      });
    }
    if (sessionId !== this.sessionId) {
      throw new HTTPException(404, {
        res: Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Session not found",
          },
          id: null,
        }),
      });
    }
    return true;
  }

  async close() {
    this.#streamMapping.forEach((value) => {
      value.stream?.close();
    });
    this.#streamMapping.clear();
    this.#requestResponseMap.clear();
    this.onclose?.();
  }

  async send(message: any, options?: { relatedRequestId?: string | number }) {
    let requestId = options?.relatedRequestId;
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      requestId = message.id;
    }

    if (requestId === undefined) {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error(
          "Cannot send a response on a standalone SSE stream unless resuming a previous client request"
        );
      }
      const standaloneSse = this.#streamMapping.get(this.#standaloneSseStreamId);
      if (standaloneSse === undefined) {
        return;
      }
      let eventId: string | undefined;
      if (this.#eventStore) {
        eventId = await this.#eventStore.storeEvent(
          this.#standaloneSseStreamId,
          message
        );
      }
      await standaloneSse.stream.writeSSE({
        id: eventId,
        event: "message",
        data: JSON.stringify(message),
      });
      return;
    }

    const streamId = this.#requestToStreamMapping.get(requestId);
    if (!streamId) {
      return;
    }

    const streamInfo = this.#streamMapping.get(streamId);
    if (!streamInfo) {
      return;
    }

    if (this.#enableJsonResponse) {
      if (streamInfo.ctx?.json) {
        streamInfo.ctx.json(message);
        streamInfo.cleanup?.();
      } else {
        this.#requestResponseMap.set(requestId, message);
      }
      return;
    }

    await streamInfo.stream.writeSSE({
      event: "message",
      data: JSON.stringify(message),
    });
  }
}
