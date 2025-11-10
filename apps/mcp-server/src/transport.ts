import { randomUUID } from "node:crypto";
import { StreamableHTTPTransport } from "@hono/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Context } from "hono";
import { transportLogger } from "./logger.js";
export type TransportType = "http" | "stdio";

export interface TransportConfig {
  type: TransportType;
  httpOptions?: {
    enableDnsRebindingProtection?: boolean;
    sessionIdGenerator?: () => string;
  };
}

export interface TransportHealth {
  status: "healthy" | "unhealthy" | "connecting" | "disconnected";
  type: TransportType;
  lastError?: string;
  connectionTime?: Date;
  requestCount: number;
  errorCount: number;
}

export class McpTransportManager {
  private transport: Transport | null = null;
  private transportType: TransportType;
  private connectionPromise: Promise<void> | null = null;
  private health: TransportHealth;
  private startTime: Date;

  constructor(config: TransportConfig) {
    this.transportType = config.type;
    this.startTime = new Date();
    this.health = {
      status: "connecting",
      type: config.type,
      requestCount: 0,
      errorCount: 0,
    };
    this.initializeTransport(config);
  }

  private initializeTransport(config: TransportConfig): void {
    transportLogger.info(`Initializing MCP transport: ${config.type}`);

    try {
      switch (config.type) {
        case "http":
          this.transport = new StreamableHTTPTransport({
            sessionIdGenerator:
              config.httpOptions?.sessionIdGenerator || randomUUID,
            enableDnsRebindingProtection:
              config.httpOptions?.enableDnsRebindingProtection ?? true,
          });
          transportLogger.debug("HTTP transport initialized", {
            enableDnsRebindingProtection:
              config.httpOptions?.enableDnsRebindingProtection ?? true,
          });
          break;

        case "stdio":
          this.transport = new StdioServerTransport();
          transportLogger.debug("STDIO transport initialized");
          break;

        default:
          throw new Error(`Unsupported transport type: ${config.type}`);
      }

      this.health.status = "disconnected";
    } catch (error) {
      this.health.status = "unhealthy";
      this.health.lastError =
        error instanceof Error ? error.message : String(error);
      transportLogger.error(
        `Failed to initialize ${config.type} transport`,
        error
      );
      throw error;
    }
  }

  getTransport(): Transport {
    if (!this.transport) {
      throw new Error("Transport not initialized");
    }
    return this.transport;
  }

  getType(): TransportType {
    return this.transportType;
  }

  getHealth(): TransportHealth {
    return { ...this.health };
  }

  async connect(server: any): Promise<void> {
    if (this.connectionPromise) {
      transportLogger.debug(
        "Connection already in progress, returning existing promise"
      );
      return this.connectionPromise;
    }

    this.health.status = "connecting";
    transportLogger.info(`Connecting MCP ${this.transportType} transport`);

    this.connectionPromise = server.connect(this.getTransport());

    try {
      await this.connectionPromise;
      this.health.status = "healthy";
      this.health.connectionTime = new Date();
      transportLogger.info(
        `${this.transportType} transport connected successfully`
      );
    } catch (error) {
      this.health.status = "unhealthy";
      this.health.lastError =
        error instanceof Error ? error.message : String(error);
      this.health.errorCount++;
      transportLogger.error(
        `Failed to connect ${this.transportType} transport`,
        error
      );
      throw error;
    }
  }

  async handleHttpRequest(context: Context): Promise<Response | undefined> {
    if (this.transportType !== "http") {
      throw new Error(
        "HTTP request handling is only available for HTTP transport"
      );
    }

    if (this.health.status !== "healthy") {
      const error = `HTTP transport is not healthy: ${this.health.status}`;
      transportLogger.error(error);
      throw new Error(error);
    }

    const httpTransport = this.transport as StreamableHTTPTransport;

    // Capture headers for logging
    const headers = {
      accept: context.req.header("Accept"),
      contentType: context.req.header("Content-Type"),
      mcpSessionId: context.req.header("MCP-Session-Id"),
    };

    try {
      await this.connectionPromise;
      this.health.requestCount++;

      transportLogger.debug("Handling HTTP request", {
        requestNumber: this.health.requestCount,
        method: context.req.method,
        url: context.req.url,
        headers,
      });

      const response = await httpTransport.handleRequest(context);
      transportLogger.debug("HTTP request handled successfully");
      return response;
    } catch (error) {
      this.health.errorCount++;
      this.health.lastError =
        error instanceof Error ? error.message : String(error);

      // Log detailed error info
      const errorDetails = {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        status: (error as any)?.status,
        headers,
      };

      // Try to extract response body from HTTPException
      if ((error as any)?.res) {
        try {
          const errorResponse = (error as any).res.clone();
          errorResponse.json().then((body: unknown) => {
            transportLogger.error("HTTP transport error response body", body);
          }).catch(() => {
            transportLogger.error("Could not parse error response body");
          });
        } catch (_) {
          // Ignore
        }
      }

      transportLogger.error("HTTP transport request handling failed", errorDetails);

      throw error;
    }
  }

  isHttpTransport(): boolean {
    return this.transportType === "http";
  }

  isStdioTransport(): boolean {
    return this.transportType === "stdio";
  }

  isHealthy(): boolean {
    return this.health.status === "healthy";
  }

  async close(): Promise<void> {
    transportLogger.info(`Closing ${this.transportType} transport`);
    this.health.status = "disconnected";

    if (this.transport) {
      try {
        await this.transport.close();
        transportLogger.info(
          `${this.transportType} transport closed successfully`
        );
      } catch (error) {
        transportLogger.error(
          `Error closing ${this.transportType} transport`,
          error
        );
      }
    }
  }

  /**
   * Get transport statistics for monitoring
   */
  getStats(): {
    uptime: number;
    health: TransportHealth;
    transportType: TransportType;
  } {
    return {
      uptime: Date.now() - this.startTime.getTime(),
      health: this.getHealth(),
      transportType: this.transportType,
    };
  }
}

export function createTransportManager(): McpTransportManager {
  const transportType = (process.env.MCP_TRANSPORT as TransportType) || "http";

  const config: TransportConfig = {
    type: transportType,
    httpOptions: {
      enableDnsRebindingProtection: process.env.NODE_ENV === "production",
      sessionIdGenerator: randomUUID,
    },
  };

  return new McpTransportManager(config);
}
