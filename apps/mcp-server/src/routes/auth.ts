import { getSession } from "@auth/server";
import { db } from "@db/kysely";
import { getRtmClient } from "@rtm-client/client";
import { Hono } from "hono";

export function authRoutes() {
  const app = new Hono();

  // Start RTM OAuth flow
  app.get("/start", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.text("Unauthorized", 401);
    }

    try {
      const rtm = getRtmClient();
      const authUrl = rtm.authUrl("write");

      return c.redirect(authUrl);
    } catch (error) {
      console.error("Failed to start RTM auth:", error);
      return c.text("Failed to start authorization", 500);
    }
  });

  // RTM OAuth callback
  app.get("/callback", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.text("Unauthorized", 401);
    }

    try {
      const user = session.user;
      const frob = c.req.query("frob");
      if (!frob) {
        return c.text("Missing frob parameter", 400);
      }

      const rtm = getRtmClient();
      const { auth } = await rtm.getToken(frob);

      const email = user.email?.toLowerCase();
      if (!email) {
        return c.text("User email not available", 400);
      }

      const now = new Date().toISOString();

      // Upsert user
      await db
        .insertInto("users")
        .values({
          id: user.id,
          email,
          email_verified: 1,
          name: user.name ?? null,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            email,
            email_verified: 1,
            name: user.name ?? null,
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

      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>RTM Connected</title>
            <style>
              body { font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center; }
              .success { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="success">✅ Successfully connected to Remember The Milk!</div>
            <p>You can now close this window and return to your application.</p>
          </body>
        </html>
      `);
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
