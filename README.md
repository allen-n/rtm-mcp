# MCP-RTM

> **Work In Progress** - Model Context Protocol server for Remember The Milk integration

A Model Context Protocol (MCP) server that connects AI assistants (like Claude) to your Remember The Milk tasks, enabling natural language task management through any MCP-compatible client.

## What is this?

This project provides a bridge between AI assistants and Remember The Milk through the [Model Context Protocol](https://modelcontextprotocol.io/). Once set up, you can:

- Ask Claude to add tasks to your RTM lists using natural language
- Complete tasks by describing them
- Query your tasks with filters
- Set priorities and manage your task list through conversation

The server handles RTM authentication, timeline management, and exposes your task data through standardized MCP tools and resources.

## Features

- 🔐 **OAuth Authentication** - Secure RTM account connection
- 🛠️ **MCP Tools** - Natural language task operations (add, complete, set priority, query)
- 📚 **MCP Resources** - Read-only access to lists and task data
- 📝 **MCP Prompts** - Pre-configured task creation templates
- 🔔 **Webhook Support** - Real-time updates from RTM (optional)
- 🔄 **Session Management** - Proper timeline handling per RTM best practices
- 🐳 **Docker Ready** - Easy deployment to Railway or any container platform

## Prerequisites

- Node.js 20+
- pnpm 9+
- Remember The Milk account
- [RTM API Key](https://www.rememberthemilk.com/services/api/) (free)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/mcp-rtm.git
cd mcp-rtm
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Get these from https://www.rememberthemilk.com/services/api/
RTM_API_KEY=your_api_key_here
RTM_SHARED_SECRET=your_shared_secret_here

# Generate a random secret for BetterAuth
BETTER_AUTH_SECRET=$(openssl rand -hex 32)

# Generate a random secret for webhook verification (optional)
RTM_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### 3. Run Database Migration

```bash
pnpm migrate
```

### 4. Start Development Servers

```bash
# Terminal 1: MCP Server
pnpm dev:mcp

# Terminal 2: Web Portal (optional)
pnpm dev:web
```

The MCP server runs on `http://localhost:8787`  
The web portal runs on `http://localhost:3000`

### 5. Connect Your RTM Account

1. Visit `http://localhost:8787/rtm/start`
2. Authorize the application on Remember The Milk
3. You'll be redirected back with a success message

### 6. Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node apps/mcp-server/dist/index.js
```

## Project Structure

```
mcp-rtm/
├── apps/
│   ├── mcp-server/          # MCP server (Hono + MCP SDK)
│   │   ├── src/
│   │   │   ├── mcp.ts       # MCP tool/resource definitions
│   │   │   ├── http.ts      # HTTP server setup
│   │   │   └── routes/      # Auth & webhook handlers
│   └── web/                 # Next.js web portal (optional)
├── packages/
│   ├── auth/                # BetterAuth configuration
│   ├── db/                  # Kysely + migrations
│   └── rtm-client/          # RTM API client
└── docker-compose.yml       # Local development setup
```

## Available MCP Tools

Once connected, the following tools are available to AI assistants:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_tasks` | Retrieve tasks from RTM | `listId?`, `filter?` |
| `add_task` | Create a new task | `name`, `listId?`, `parse?` |
| `complete_task` | Mark a task complete | `listId`, `taskseriesId`, `taskId` |
| `set_priority` | Set task priority | `listId`, `taskseriesId`, `taskId`, `priority` |

## Configuration

### Authentication Strategy

**🚧 Decision Needed:** Choose your authentication approach in `.env`:

```bash
# Option 1: Magic link (simpler, no passwords)
AUTH_STRATEGY=magic_link

# Option 2: Email/password (traditional)
AUTH_STRATEGY=email_password

# Option 3: OAuth providers (requires additional setup)
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...
```

See `packages/auth/src/server.ts` to configure your chosen method.

### Webhook Configuration (Optional)

RTM can push real-time updates via webhooks:

```bash
# In .env
RTM_WEBHOOK_SECRET=your_random_secret_here

# Your webhook URL (must be HTTPS in production)
WEBHOOK_URL=https://your-domain.com/webhook/rtm
```

**🚧 Decision Needed:** Define what happens when tasks are created/completed/tagged in `apps/mcp-server/src/routes/webhook.ts`.

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @packages/rtm-client test
```

### Building

```bash
# Build all packages
pnpm build

# Build specific app
pnpm --filter @apps/mcp-server build
```

### Database Migrations

```bash
# Run pending migrations
pnpm migrate

# Create new migration
cd packages/db
# Add new .ts file in src/migrations/ with format: NNNN_description.ts
```

## Deployment

### Docker Compose (Local)

```bash
docker compose up
```

### Railway (Production)

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Add services:
   ```bash
   railway add --service mcp
   railway add --service web
   ```
5. Set environment variables in Railway dashboard
6. Deploy:
   ```bash
   railway up
   ```

**Important:** Set the correct `RTM_CALLBACK_URL` to your Railway domain.

## Known Issues & TODOs

- [ ] **MCP User Context**: Currently using placeholder `userId` in MCP tools. Need to determine how to pass authenticated user context through MCP protocol.
- [ ] **Webhook Handlers**: Event handlers are stubs. Define your business logic for task events.
- [ ] **Error Recovery**: Add retry logic with exponential backoff for RTM 503 errors.
- [ ] **Rate Limiting**: Current implementation is basic. Consider per-user rate limiting.
- [ ] **Tests**: Need comprehensive test coverage for RTM client and MCP tools.

## Architecture Decisions

### Timeline Management

RTM requires "timelines" for write operations. Per RTM best practices, we:
- Create a new timeline per user session
- Cache timelines for 24 hours
- Refresh expired timelines automatically

This differs from storing a single permanent timeline per user.

### Database Choice

Using SQLite with Kysely for:
- Zero-configuration development
- Easy Railway deployment
- Type-safe queries
- Simple migrations

For production at scale, consider PostgreSQL.

### Monorepo Structure

Using pnpm workspaces to:
- Share code between MCP server and web portal
- Reuse auth and database packages
- Maintain single source of truth for RTM client

## API Rate Limits

Remember The Milk allows approximately 1 request per second per user. The `rtm-client` package implements automatic rate limiting with 500ms between requests.

For high-traffic scenarios, consider:
- Caching list and task data
- Batch operations where possible
- Implementing request queuing per user

## Contributing

This is a work-in-progress project. Key areas needing decisions:

1. **Authentication**: Choose magic link vs email/password vs OAuth
2. **MCP Context**: Determine user identification strategy in MCP
3. **Webhooks**: Define event handling logic for your use case
4. **Error Handling**: Implement comprehensive retry and recovery logic

See `DECISIONS.md` for detailed decision points.

## Resources

- [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- [Remember The Milk API](https://www.rememberthemilk.com/services/api/)
- [BetterAuth Documentation](https://www.better-auth.com/)
- [Kysely Documentation](https://kysely.dev/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## License

MIT

---

**Questions?** Open an issue or check the [Discussions](https://github.com/allen-n/rtm-mcp/discussions) tab.
