import { getSession } from "@auth/server";
import { db } from "@db/kysely";
import { getRtmClient } from "@rtm-client/client";
import { Hono } from "hono";

export function authRoutes() {
  const app = new Hono();

  // Start RTM OAuth flow (desktop flow - no callback URL needed)
  app.get("/start", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.text("Unauthorized", 401);
    }

    try {
      const rtm = getRtmClient();

      // Get a frob first (desktop flow)
      const frob = await rtm.getFrob();

      // Store frob in session/database temporarily
      // For now, we'll pass it via query param when user returns
      const now = new Date().toISOString();
      await db
        .insertInto("rtm_tokens")
        .values({
          user_id: session.user.id,
          auth_token: frob, // Temporarily store frob here
          perms: "pending",
          status: "pending",
          username: "",
          fullname: "",
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            auth_token: frob,
            perms: "pending",
            status: "pending",
            updated_at: now,
          })
        )
        .execute();

      // Generate auth URL with frob (desktop flow)
      const authUrl = rtm.authUrl("write", frob);

      // Redirect to web app with auth URL
      const webAppUrl = process.env.WEB_APP_URL || "http://localhost:3000";
      const redirectUrl = `${webAppUrl}/rtm/connect?authUrl=${encodeURIComponent(
        authUrl
      )}`;
      return c.redirect(redirectUrl);
    } catch (error) {
      console.error("Failed to start RTM auth:", error);
      return c.text("Failed to start authorization", 500);
    }
  });

  // Complete RTM authorization (called from web app)
  app.get("/complete", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.text("Unauthorized", 401);
    }

    try {
      const user = session.user;

      // In desktop flow, retrieve the frob we stored earlier
      const tokenRecord = await db
        .selectFrom("rtm_tokens")
        .select(["auth_token"])
        .where("user_id", "=", user.id)
        .where("status", "=", "pending")
        .executeTakeFirst();

      if (!tokenRecord) {
        return c.text(
          "No pending authorization found. Please start the auth flow again.",
          400
        );
      }

      const frob = tokenRecord.auth_token;
      const rtm = getRtmClient();
      const { auth } = await rtm.getToken(frob);

      const email = user.email?.toLowerCase();
      if (!email) {
        return c.text("User email not available", 400);
      }

      const now = new Date().toISOString();

      // Upsert user
      await db
        .insertInto("user")
        .values({
          id: user.id,
          email,
          email_verified: true,
          name: user.name || "",
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            email,
            email_verified: true,
            name: user.name || "",
            updated_at: now,
          })
        )
        .execute();

      // Store RTM token
      await db
        .insertInto("rtm_tokens")
        .values({
          user_id: user.id,
          auth_token: auth.token,
          perms: auth.perms,
          status: "active",
          username: auth.user.username,
          fullname: auth.user.fullname,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            auth_token: auth.token,
            perms: auth.perms,
            status: "active",
            username: auth.user.username,
            fullname: auth.user.fullname,
            updated_at: now,
          })
        )
        .execute();

      return c.json({ success: true });
    } catch (error) {
      console.error("RTM callback error:", error);
      return c.text("Failed to complete authorization", 500);
    }
  });

  // Check RTM connection status
  app.get("/status", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const user = session.user;

      const token = await db
        .selectFrom("rtm_tokens")
        .select(["auth_token", "status", "username", "perms", "updated_at"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!token) {
        return c.json({ connected: false });
      }

      // Verify token is still valid
      let isValid = false;
      if (token.status === "active") {
        const rtm = getRtmClient();
        isValid = await rtm.checkToken(token.auth_token);
      }

      if (!isValid && token.status === "active") {
        // Mark as invalid
        await db
          .updateTable("rtm_tokens")
          .set({
            status: "invalid",
            updated_at: new Date().toISOString(),
          })
          .where("user_id", "=", user.id)
          .execute();
      }

      return c.json({
        connected: isValid,
        username: token.username,
        perms: token.perms,
        lastUpdated: token.updated_at,
      });
    } catch (error) {
      console.error("Status check error:", error);
      return c.json({ error: "Failed to check status" }, 500);
    }
  });

  // Disconnect RTM
  app.post("/disconnect", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const user = session.user;

      await db
        .deleteFrom("rtm_tokens")
        .where("user_id", "=", user.id)
        .execute();

      return c.json({ success: true });
    } catch (error) {
      console.error("Disconnect error:", error);
      return c.json({ error: "Failed to disconnect" }, 500);
    }
  });

  return app;
}
