import { serve } from "@hono/node-server";
import { app } from "./http.js";

const port = parseInt(process.env.PORT || "8787", 10);

console.log(`🚀 MCP-RTM Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
