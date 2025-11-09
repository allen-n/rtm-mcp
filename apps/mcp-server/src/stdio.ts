#!/usr/bin/env node

import { mcpServer } from "./mcp.js";
import { createTransportManager } from "./transport.js";

console.error("🚀 Starting MCP RTM Server (STDIO mode)");

async function main() {
  try {
    // Force STDIO transport for this entry point
    process.env.MCP_TRANSPORT = "stdio";
    
    const transportManager = createTransportManager();
    
    console.error("📡 Connecting MCP server to STDIO transport...");
    await transportManager.connect(mcpServer);
    
    console.error("✅ MCP RTM Server is running on STDIO transport");
    console.error("📝 Ready to handle MCP requests via standard input/output");
    console.error("⚠️  Note: STDIO mode uses a default user context for testing");
    
    // Keep the process alive
    process.stdin.on("end", () => {
      console.error("🛑 STDIO stream ended, shutting down...");
      transportManager.close().then(() => {
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      console.error("🛑 Received SIGINT, shutting down gracefully...");
      await transportManager.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("🛑 Received SIGTERM, shutting down gracefully...");
      await transportManager.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Failed to start MCP RTM Server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error in main():", error);
  process.exit(1);
});