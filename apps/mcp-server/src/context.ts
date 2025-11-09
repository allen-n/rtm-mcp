import { randomUUID } from "node:crypto";

/**
 * Simple HTTP-based user context for MCP requests
 * This replaces the complex AsyncLocalStorage pattern with a simpler approach
 * that works better with HTTP transport
 */
export class HttpUserContext {
  private static userContextStore = new Map<string, string>();

  /**
   * Create a new context for a user session
   */
  static createContext(userId: string): string {
    const contextId = randomUUID();
    this.userContextStore.set(contextId, userId);
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      this.userContextStore.delete(contextId);
    }, 5 * 60 * 1000);

    return contextId;
  }

  /**
   * Get user ID from context
   */
  static getUserId(contextId: string): string | null {
    return this.userContextStore.get(contextId) || null;
  }

  /**
   * Validate that a user context exists
   */
  static validateContext(contextId: string): boolean {
    return this.userContextStore.has(contextId);
  }

  /**
   * Clean up a context (call when request is complete)
   */
  static cleanupContext(contextId: string): void {
    this.userContextStore.delete(contextId);
  }

  /**
   * Get current context size (for debugging)
   */
  static getContextSize(): number {
    return this.userContextStore.size;
  }

  /**
   * Clear all contexts (useful for testing)
   */
  static clearAll(): void {
    this.userContextStore.clear();
  }
}

/**
 * Simple callback-based context wrapper for HTTP requests
 * This is much simpler than AsyncLocalStorage for HTTP transport
 */
export async function withHttpUserContext<T>(
  userId: string,
  callback: () => Promise<T>
): Promise<T> {
  const contextId = HttpUserContext.createContext(userId);
  
  try {
    const result = await callback();
    return result;
  } finally {
    HttpUserContext.cleanupContext(contextId);
  }
}