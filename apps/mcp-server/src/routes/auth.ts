import { Hono } from "hono";
import { getRtmClient } from "@rtm-client/client";
import { db } from "@db/kysely";
import { getSession, requireUser } from "@auth/server";

export function authRoutes() {
  const app = new Hono();

  // Start RTM OAuth flow
  app.get("/start", async (c) => {
    try {
      const session = await getSession(c.req.raw);
      const user = requireUser(session);

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
    try {
      const session = await getSession(c.req.raw);
      const user = requireUser(session);

      const frob = c.req.query("frob");
      if (!frob) {
        return c.text("Missing frob parameter", 400);
      }

      const rtm = getRtmClient();
      const { auth } = await rtm.getToken(frob);

      // Upsert user
      await db
        .insertInto("users")
        .values({
          id: user.id,
          email: user.email ?? null,
          name: user.name ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            email: user.email ?? null,
            name: user.name ?? null,
            updated_at: new Date().toISOString(),
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
          updated_at: new Date().toISOString(),
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            auth_token: auth.token,
            perms: auth.perms,
            status: "active",
            username: auth.user.username,
            fullname: auth.user.fullname,
            updated_at: new Date().toISOString(),
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
    try {
      const session = await getSession(c.req.raw);
      const user = requireUser(session);

      const token = await db
        .selectFrom("rtm_tokens")
        .select(["status", "username", "perms", "updated_at"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!token) {
        return c.json({ connected: false });
      }

      // Verify token is still valid
      const rtm = getRtmClient();
      const isValid = await rtm.checkToken(token.status === "active" ? token.username || "" : "");

      if (!isValid && token.status === "active") {
        // Mark as invalid
        await db
          .updateTable("rtm_tokens")
          .set({ status: "invalid" })
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
    try {
      const session = await getSession(c.req.raw);
      const user = requireUser(session);

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
