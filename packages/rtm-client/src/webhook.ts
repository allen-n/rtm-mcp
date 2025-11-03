import crypto from "node:crypto";
import type { WebhookEvent } from "./types";

/**
 * Verify RTM webhook signature
 *
 * RTM signs webhooks with HMAC-SHA256 in X-Hook-Signature header
 * Format: timestamp.signature
 * Payload for HMAC: timestamp.event_id
 */
export function verifyWebhookSignature(
  signature: string,
  eventId: string,
  secret: string
): boolean {
  try {
    const [timestamp, receivedSig] = signature.split(".");

    if (!timestamp || !receivedSig) {
      return false;
    }

    // Check timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const sigTime = parseInt(timestamp, 10);

    if (Math.abs(now - sigTime) > 300) {
      console.warn("Webhook signature timestamp too old");
      return false;
    }

    // Compute expected signature
    const payload = `${timestamp}.${eventId}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig),
      Buffer.from(expectedSig)
    );
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}

/**
 * Parse and validate webhook event
 */
export function parseWebhookEvent(body: any): WebhookEvent | null {
  try {
    if (!body.id || !body.ts || !body.type) {
      return null;
    }

    return {
      id: body.id,
      ts: body.ts,
      type: body.type,
      data: body.data || {},
    };
  } catch {
    return null;
  }
}
