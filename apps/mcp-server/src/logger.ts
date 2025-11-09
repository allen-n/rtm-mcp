import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  userId?: string;
  requestId?: string;
}

/**
 * MCP-specific logger that writes to stderr (safe for STDIO transport)
 * and provides structured logging for debugging
 */
export class McpLogger {
  private component: string;
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000;

  constructor(component: string) {
    this.component = component;
  }

  private shouldLog(level: LogLevel): boolean {
    const debugLevel = (process.env.DEBUG || "").toLowerCase();
    const logLevel = (process.env.LOG_LEVEL || "info").toLowerCase();

    // If DEBUG includes our component, log everything
    if (
      debugLevel.includes(this.component.toLowerCase()) ||
      debugLevel.includes("mcp:*")
    ) {
      return true;
    }

    // Otherwise, check log level
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[logLevel as LogLevel];
  }

  private log(
    level: LogLevel,
    message: string,
    data?: any,
    userId?: string,
    requestId?: string
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      level,
      component: this.component,
      message,
      data,
      userId,
      requestId,
    };

    // Store in memory (circular buffer)
    McpLogger.logs.push(entry);
    if (McpLogger.logs.length > McpLogger.maxLogs) {
      McpLogger.logs.shift();
    }

    // Format and write to stderr (safe for STDIO transport)
    const formatted = this.formatLogEntry(entry);
    console.error(formatted);
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component.padEnd(15);
    const requestId = entry.requestId ? `[${entry.requestId}] ` : "";
    const userId = entry.userId ? `(${entry.userId}) ` : "";

    let formatted = `[${timestamp}] ${level} ${component} ${requestId}${userId}${entry.message}`;

    if (entry.data) {
      try {
        const dataStr =
          typeof entry.data === "string"
            ? entry.data
            : JSON.stringify(entry.data, null, 2);
        formatted += `\n${dataStr}`;
      } catch {
        formatted += `\n[Unable to serialize data]`;
      }
    }

    return formatted;
  }

  debug(
    message: string,
    data?: any,
    userId?: string,
    requestId?: string
  ): void {
    this.log("debug", message, data, userId, requestId);
  }

  info(message: string, data?: any, userId?: string, requestId?: string): void {
    this.log("info", message, data, userId, requestId);
  }

  warn(message: string, data?: any, userId?: string, requestId?: string): void {
    this.log("warn", message, data, userId, requestId);
  }

  error(
    message: string,
    data?: any,
    userId?: string,
    requestId?: string
  ): void {
    this.log("error", message, data, userId, requestId);
  }

  /**
   * Get recent logs for debugging
   */
  static getRecentLogs(
    level?: LogLevel,
    component?: string,
    limit = 100
  ): LogEntry[] {
    let logs = [...McpLogger.logs];

    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    if (component) {
      logs = logs.filter((log) => log.component === component);
    }

    return logs.slice(-limit);
  }

  /**
   * Clear log history
   */
  static clearLogs(): void {
    McpLogger.logs = [];
  }
}

// Pre-configured loggers for different components
export const transportLogger = new McpLogger("transport");
export const authLogger = new McpLogger("auth");
export const mcpLogger = new McpLogger("mcp");
export const httpLogger = new McpLogger("http");
export const contextLogger = new McpLogger("context");
export const rtmLogger = new McpLogger("rtm-client");
