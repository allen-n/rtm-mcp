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

      // Show instructions page with link to RTM and callback button
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connect to Remember The Milk</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                max-width: 600px; 
                margin: 50px auto; 
                padding: 20px;
                line-height: 1.6;
              }
              .step { 
                background: #f5f5f5; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0;
              }
              .button {
                display: inline-block;
                padding: 12px 24px;
                background: #0066cc;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                margin: 10px 10px 10px 0;
              }
              .button:hover { background: #0052a3; }
              .button-secondary {
                background: #666;
              }
              .button-secondary:hover { background: #444; }
            </style>
          </head>
          <body>
            <h1>🔗 Connect to Remember The Milk</h1>
            <div class="step">
              <h2>Step 1: Authorize on RTM</h2>
              <p>Click the button below to open Remember The Milk and authorize this application:</p>
              <a href="${authUrl}" target="_blank" class="button">Open Remember The Milk</a>
            </div>
            <div class="step">
              <h2>Step 2: Return Here</h2>
              <p>After authorizing on RTM, click this button to complete the connection:</p>
              <a href="/rtm/callback" class="button button-secondary">I've Authorized - Complete Setup</a>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Failed to start RTM auth:", error);
      return c.text("Failed to start authorization", 500);
    }
  });

  // RTM OAuth callback (desktop flow - user returns here after approving)
  app.get("/callback", async (c) => {
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
