import { verifyWebhookSignature, parseWebhookEvent } from "@rtm-client/webhook";
import { Hono } from "hono";

export function webhookRoutes() {
  const app = new Hono();

  // RTM webhook endpoint
  app.post("/rtm", async (c) => {
    const signature = c.req.header("X-Hook-Signature");
    const secret = process.env.RTM_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error("Missing webhook signature or secret");
      return c.text("Unauthorized", 401);
    }

    try {
      const body = await c.req.json();
      const event = parseWebhookEvent(body);

      if (!event) {
        console.error("Invalid webhook event format");
        return c.text("Bad Request", 400);
      }

      // Verify HMAC-SHA256 signature
      if (!verifyWebhookSignature(signature, event.id, secret)) {
        console.error("Webhook signature verification failed");
        return c.text("Unauthorized", 401);
      }

      // Process event
      console.log("Webhook event received:", event.type, event.id);

      // Implement event handlers based on needs (currently stubbed)
      switch (event.type) {
        case "task_created":
          await handleTaskCreated(event);
          break;
        case "task_completed":
          await handleTaskCompleted(event);
          break;
        case "task_tagged":
          await handleTaskTagged(event);
          break;
        case "changes_available":
          await handleChangesAvailable(event);
          break;
        default:
          console.log("Unhandled event type:", event.type);
      }

      // RTM expects 200 response
      return c.text("OK", 200);
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.text("Internal Server Error", 500);
    }
  });

  // Webhook verification endpoint (for RTM to verify URL)
  app.get("/rtm", (c) => {
    // RTM may send GET requests to verify the endpoint
    return c.text("Webhook endpoint active", 200);
  });

  return app;
}

// Event handlers - stubbed for now
async function handleTaskCreated(event: any) {
  console.log("Task created:", event.data);
  // TODO: Implement logic (e.g., notify user, update cache, etc.)
}

async function handleTaskCompleted(event: any) {
  console.log("Task completed:", event.data);
  // TODO: Implement logic
}

async function handleTaskTagged(event: any) {
  console.log("Task tagged:", event.data);
  // TODO: Implement logic
}

async function handleChangesAvailable(event: any) {
  console.log("Changes available for user");
  // TODO: Implement sync logic if needed
}
