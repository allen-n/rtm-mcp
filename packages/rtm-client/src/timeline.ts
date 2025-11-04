import { db } from "@db/kysely";
import { getRtmClient, RtmApiError } from "./client.js";
import { randomUUID } from "node:crypto";

/**
 * Get or create a timeline for the current session
 * Timelines are refreshed every 24 hours
 */
export async function getOrCreateTimeline(
  userId: string,
  authToken: string
): Promise<string> {
  const rtm = getRtmClient();

  // Check for existing valid timeline
  const existing = await db
    .selectFrom("rtm_timelines")
    .select(["timeline", "expires_at"])
    .where("user_id", "=", userId)
    .where("expires_at", ">", new Date().toISOString())
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  if (existing) {
    return existing.timeline;
  }

  // Create new timeline
  try {
    const timeline = await rtm.createTimeline(authToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await db
      .insertInto("rtm_timelines")
      .values({
        id: randomUUID(),
        user_id: userId,
        timeline,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .execute();

    // Clean up old timelines
    await db
      .deleteFrom("rtm_timelines")
      .where("user_id", "=", userId)
      .where("expires_at", "<", now.toISOString())
      .execute();

    return timeline;
  } catch (error) {
    if (error instanceof RtmApiError && error.isInvalidToken()) {
      // Mark token as invalid
      await db
        .updateTable("rtm_tokens")
        .set({ status: "invalid" })
        .where("user_id", "=", userId)
        .execute();

      throw new Error("RTM token is invalid. Please re-authorize.");
    }

    throw error;
  }
}
