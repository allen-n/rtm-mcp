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
        .select(["auth_token", "status"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!tokenRecord) {
        return c.text(
          "No authorization found. Please start the auth flow again.",
          400
        );
      }

      // If already active, the auth was already completed - return success
      if (tokenRecord.status === "active") {
        return c.json({ success: true, message: "Already connected" });
      }

      // Must be pending to continue
      if (tokenRecord.status !== "pending") {
        return c.text(
          "Invalid authorization status. Please start the auth flow again.",
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

      // Skip validation if token is not active
      if (token.status !== "active") {
        return c.json({
          connected: false,
          username: token.username,
          perms: token.perms,
          lastUpdated: token.updated_at,
          error: "Token status is not active",
        });
      }

      // Verify token is still valid using both methods for detailed status
      const rtm = getRtmClient();
      let checkTokenValid = false;
      let testLoginValid = false;
      let checkTokenError: string | null = null;
      let testLoginError: string | null = null;

      try {
        checkTokenValid = await rtm.checkToken(token.auth_token);
      } catch (error) {
        checkTokenError =
          error instanceof Error ? error.message : String(error);
      }

      try {
        const userInfo = await rtm.testLogin(token.auth_token);
        testLoginValid = userInfo !== null;
      } catch (error) {
        testLoginError = error instanceof Error ? error.message : String(error);
      }

      // If both methods agree the token is invalid, delete it
      if (!checkTokenValid && !testLoginValid) {
        await db
          .deleteFrom("rtm_tokens")
          .where("user_id", "=", user.id)
          .execute();

        return c.json({
          connected: false,
          username: token.username,
          perms: token.perms,
          lastUpdated: token.updated_at,
          error: "Token has been revoked or is invalid",
          details: {
            checkToken: { valid: false, error: checkTokenError },
            testLogin: { valid: false, error: testLoginError },
          },
        });
      }

      // If results disagree, something is wrong - report detailed status
      if (checkTokenValid !== testLoginValid) {
        return c.json({
          connected: false,
          username: token.username,
          perms: token.perms,
          lastUpdated: token.updated_at,
          error: "Token validation methods disagree",
          details: {
            checkToken: { valid: checkTokenValid, error: checkTokenError },
            testLogin: { valid: testLoginValid, error: testLoginError },
          },
        });
      }

      // Both methods confirm token is valid
      return c.json({
        connected: true,
        username: token.username,
        perms: token.perms,
        lastUpdated: token.updated_at,
      });
    } catch (error) {
      console.error("Status check error:", error);
      return c.json(
        {
          error: "Failed to check status",
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });

  // Verify RTM token is revoked (user must revoke on RTM website first)
  app.post("/verify-disconnect", async (c) => {
    const session = await getSession(c.req.raw);
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const user = session.user;

      // Get stored token
      const tokenRecord = await db
        .selectFrom("rtm_tokens")
        .select(["auth_token"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!tokenRecord) {
        return c.json({
          revoked: true,
          message: "No token found - already disconnected",
        });
      }

      // Test if token is still valid
      const rtm = getRtmClient();
      const user_info = await rtm.testLogin(tokenRecord.auth_token);

      if (user_info === null) {
        // Token is revoked! Safe to delete from our database
        await db
          .deleteFrom("rtm_tokens")
          .where("user_id", "=", user.id)
          .execute();

        return c.json({
          revoked: true,
          message:
            "Token revoked successfully - disconnected from our database",
        });
      }

      // Token is still valid - user hasn't revoked it yet
      return c.json({
        revoked: false,
        message:
          "Token is still active - please revoke access on RTM website first",
      });
    } catch (error) {
      console.error("Verify disconnect error:", error);
      return c.json({ error: "Failed to verify disconnect status" }, 500);
    }
  });

  return app;
}
