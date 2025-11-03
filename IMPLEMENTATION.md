# MCP-RTM Initial Implementation

This is the initial implementation of the MCP-RTM server based on the specification.

## What's Been Implemented

### Monorepo Structure
- ✅ pnpm workspace with proper configuration
- ✅ TypeScript base configuration with path aliases
- ✅ Environment variables setup (.env.example)
- ✅ Git ignore configuration

### Packages

#### `packages/db` - Database Layer
- ✅ Kysely ORM with SQLite
- ✅ Database schema for users, sessions, accounts, RTM tokens, timelines, webhooks
- ✅ Migration system with initial migration
- ✅ Successfully ran migrations and created database

#### `packages/auth` - Authentication
- ✅ BetterAuth integration
- ✅ Email/password authentication enabled (for dev)
- ✅ OAuth providers scaffolded (currently disabled)
- ✅ Session management helpers

#### `packages/rtm-client` - RTM API Client
- ✅ Full RTM API client with rate limiting
- ✅ API signature generation
- ✅ Timeline management (session-based, 24h expiry)
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Error handling with custom RtmApiError class
- ✅ Webhook methods stubbed for future implementation

### Applications

#### `apps/mcp-server` - MCP Server
- ✅ Hono HTTP server
- ✅ MCP SDK integration with StreamableHTTP transport
- ✅ MCP Tools implemented:
  - `get_tasks` - Retrieve tasks from RTM
  - `add_task` - Create new tasks with Smart Add syntax
  - `complete_task` - Mark tasks as complete
  - `set_priority` - Set task priority
- ✅ MCP Resources:
  - `rtm_lists` - User's RTM lists
- ✅ MCP Prompts:
  - `create_daily_task` - Template for daily tasks
- ✅ Auth routes for RTM OAuth flow
- ✅ Webhook routes (stubbed handlers)

#### `apps/web` - Next.js Web Portal
- ✅ Basic Next.js 15 setup
- ✅ Landing page with RTM connection link
- ✅ BetterAuth integration

### Infrastructure
- ✅ Docker Compose configuration
- ✅ Dockerfiles for all services
- ✅ Volume management for SQLite database

## Current Status

### Working
- Database migrations run successfully
- All dependencies installed
- Project structure complete
- All source files created

### Known Issues (To Be Fixed)
1. **TypeScript Build Errors**: Some type mismatches between BetterAuth types and custom types
   - Solution: Will need to adjust type definitions or use runtime TypeScript execution (tsx)

2. **MCP User Context**: userId is currently hardcoded as "current_user_id"
   - Solution: Need to implement proper user context passing through MCP protocol

3. **Webhook Handlers**: Currently stubbed
   - Solution: Implement actual event handling logic based on requirements

### Not Yet Implemented (As Per Spec)
1. **Automated Webhook Renewal**: Infrastructure in place, but renewal logic stubbed
2. **Full OAuth Provider Configuration**: GitHub/Google OAuth commented out, can be enabled
3. **Email Verification**: Currently disabled for dev convenience

## How to Run

### Prerequisites
- Node.js 20+
- pnpm 9.11.0

### Setup
```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env and add your RTM API credentials:
# RTM_API_KEY=your_key_here
# RTM_SHARED_SECRET=your_secret_here
# BETTER_AUTH_SECRET=generate_random_secret

# Run migrations
pnpm migrate
```

### Development
```bash
# Start MCP server (using tsx for runtime TypeScript)
pnpm dev:mcp

# Start web app (in another terminal)
pnpm dev:web
```

### Docker
```bash
# Make sure .env file is configured
docker-compose up
```

## Next Steps

1. **Fix TypeScript Types**: Resolve type mismatches with BetterAuth
2. **Test RTM OAuth Flow**: Requires actual RTM API credentials
3. **Implement MCP User Context**: Pass userId properly through MCP
4. **Implement Webhook Handlers**: Add actual event processing logic
5. **Add Automated Tests**: Unit and integration tests
6. **Deploy to Railway**: Set up production environment

## Architecture Decisions Implemented

Based on user's decisions:
1. **Auth Strategy**: OAuth + Email/Password (email verification disabled for dev)
2. **Security**: Using most secure and idiomatic approaches (HMAC-SHA256, timing-safe comparisons)
3. **Webhooks**: Infrastructure ready but handlers stubbed
4. **Lease Renewal**: Infrastructure ready but renewal logic stubbed

## File Structure
```text
mcp-rtm/
├── apps/
│   ├── mcp-server/          # MCP server with Hono
│   └── web/                 # Next.js web portal
├── packages/
│   ├── auth/                # BetterAuth configuration
│   ├── db/                  # Kysely database layer
│   └── rtm-client/          # RTM API client
├── docker-compose.yml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## API Endpoints

### MCP Server (Port 8787)
- `POST /mcp` - MCP protocol endpoint
- `GET /health` - Health check
- `GET /rtm/start` - Start RTM OAuth flow
- `GET /rtm/callback` - RTM OAuth callback
- `GET /rtm/status` - Check RTM connection status
- `POST /rtm/disconnect` - Disconnect RTM
- `POST /webhook/rtm` - RTM webhook receiver
- `/api/auth/*` - BetterAuth endpoints

### Web App (Port 3000)
- `/` - Landing page
- `/api/auth/*` - BetterAuth endpoints

## Notes

This is an initial implementation focusing on:
- Correct project structure
- Core functionality scaffolding
- Proper use of industry-standard tools (pnpm, Kysely, BetterAuth, MCP SDK)
- Following the specification as closely as possible

The implementation is production-ready in terms of structure but needs:
- Type refinements
- Testing
- Actual RTM credentials for end-to-end testing
- User context implementation in MCP
