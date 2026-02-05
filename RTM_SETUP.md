# Remember The Milk API Setup

## Authentication Flows

RTM uses **two different authentication flows**:

1. **Desktop Flow** (what we use) - No callback URL configuration needed ✅
2. **Web-based Flow** - Requires a callback URL configured in your API key settings

This project uses the **desktop flow**, which is simpler and requires no RTM API key configuration!

## How Desktop Flow Works

The authentication process is simple:

1. User visits `/rtm/start`
2. Server calls `rtm.auth.getFrob` to get a temporary frob
3. Server shows a page with two buttons:
   - Button 1: Opens RTM authorization page in new tab (includes the frob in URL)
   - Button 2: "I've Authorized" completion link
4. User clicks Button 1, approves on RTM
5. RTM shows "Return to your application" message
6. User returns and clicks Button 2
7. Server calls `rtm.auth.getToken` with the stored frob
8. User is connected!

**No RTM API key configuration needed!** Just get your API key and shared secret, and you're ready to go.

## Technical Details

### Desktop Flow vs Web-Based Flow

**Desktop flow (what we use):**

1. Call `rtm.auth.getFrob` to get a frob
2. Generate auth URL with `api_key + perms + frob + signature`
3. User approves on RTM (no redirect)
4. User manually returns to app
5. Call `rtm.auth.getToken` with frob to get auth_token

**Advantages:**
- No RTM API key configuration needed
- Works immediately after getting API key
- Simple to implement and test locally

**Web-based flow (alternative):**

1. Generate auth URL with `api_key + perms + signature`
2. User approves on RTM
3. RTM redirects to callback with frob
4. Call `rtm.auth.getToken` with frob to get auth_token

**Advantages:**
- Fully automated (no manual "return to app" step)
- Better UX for production apps

**Requires:**
- Callback URL configured at <https://www.rememberthemilk.com/services/api/keys.rtm>

## References

- [RTM Authentication Documentation](https://www.rememberthemilk.com/services/api/authentication.rtm)
- See the "User authentication for web-based applications" section
