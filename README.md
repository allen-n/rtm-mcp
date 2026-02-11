# MCP-RTM

> Model Context Protocol server for Remember The Milk integration

A Model Context Protocol (MCP) server that connects AI assistants (like Claude) to your Remember The Milk tasks, enabling natural language task management through any MCP-compatible client.

## What is this?

This project provides a bridge between AI assistants and Remember The Milk through the [Model Context Protocol](https://modelcontextprotocol.io/). Once set up, you can:

- Ask Claude to add tasks to your RTM lists using natural language
- Complete tasks by describing them
- Query your tasks with filters
- Set priorities, due dates, tags, and manage your task list through conversation

The server handles RTM authentication, timeline management, and exposes your task data through standardized MCP tools and resources.

## Features

- 🔐 **OAuth Authentication** - Secure RTM account connection via web portal
- 🛠️ **30+ MCP Tools** - Full RTM API coverage (tasks, lists, tags, notes, locations, settings)
- 📚 **MCP Resources** - Read-only access to lists, tags, and location data
- 📝 **MCP Prompts** - Pre-configured templates for common workflows
- 🔔 **Webhook Support** - Real-time updates from RTM (optional)
- 🔄 **Per-User Rate Limiting** - Automatic throttling per RTM best practices
- 🐳 **Docker Ready** - Easy deployment to Railway or any container platform
- ⚡ **Turbo Build System** - Fast, cached builds for monorepo development

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local development)
- Remember The Milk account
- [RTM API Key](https://www.rememberthemilk.com/services/api/) (free)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/allen-n/rtm-mcp.git
cd rtm-mcp
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

# Local Postgres defaults (change if you already run Postgres)
POSTGRES_USER=rtm
POSTGRES_PASSWORD=rtm
POSTGRES_DB=rtmdb
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_SSL=false
```

### 3. Start with Docker Compose (Recommended)

The easiest way to run locally is with Docker Compose, which mirrors the production setup:

```bash
# Start all services (postgres, migrations, mcp server, web portal)
docker compose up --build

# Or start specific services
docker compose up -d postgres    # Just the database
docker compose up --build mcp    # MCP server + dependencies
docker compose up --build web    # Web portal + dependencies
```

This will:
- Start PostgreSQL on port 5432
- Run database migrations automatically
- Start the MCP server on `http://localhost:8787`
- Start the web portal on `http://localhost:3000`

### 4. Alternative: Native Development

If you prefer running services natively (faster hot reload):

```bash
# Start just Postgres via Docker
docker compose up -d postgres

# Run migrations
pnpm migrate

# Start all services with Turbo (parallel, cached builds)
pnpm dev

# Or start individual services
pnpm dev:mcp   # MCP server only
pnpm dev:web   # Web portal only
```

The MCP server runs on `http://localhost:8787`  
The web portal runs on `http://localhost:3000`

### 5. Connect Your RTM Account

1. Visit `http://localhost:3000` (web portal)
2. Create an account with email/password
3. Click "Connect RTM" to link your Remember The Milk account
4. Authorize the application on RTM
5. You'll see a success message when connected!

### 6. Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
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
│   │   ├── Dockerfile       # Container build
│   │   └── railway.json     # Railway deployment config
│   └── web/                 # Next.js web portal
│       ├── Dockerfile
│       └── railway.json
├── packages/
│   ├── auth/                # BetterAuth configuration
│   ├── db/                  # Kysely + migrations
│   │   └── Dockerfile       # Migrations runner
│   └── rtm-client/          # RTM API client with rate limiting
├── docker-compose.yml       # Local development setup
└── turbo.json               # Turbo build configuration
```

## Authentication

This project uses [BetterAuth](https://www.better-auth.com/) for authentication:

- **Email/Password**: Primary authentication method. Users sign up with email and password via the web portal.
- **Session Management**: Sessions last 7 days with automatic renewal.
- **API Keys**: For programmatic MCP access (useful for integrating with Claude Desktop or other MCP clients).

The web portal handles user registration and RTM OAuth connection. Once connected, users can use the MCP server with their API key.

### OAuth Providers (Optional)

Social login (GitHub, Google) is supported but disabled by default. To enable, uncomment the `socialProviders` section in `packages/auth/src/server.ts` and set the required environment variables.

## Available MCP Tools

Once connected, the following tools are available to AI assistants:

### Task Management

| Tool | Description |
|------|-------------|
| `get_tasks` | Retrieve tasks with RTM filter syntax |
| `add_task` | Create task (supports Smart Add: `!1 ^tomorrow #tag`) |
| `complete_task` | Mark a task complete |
| `uncomplete_task` | Mark a completed task as not done |
| `delete_task` | Permanently delete a task |
| `rename_task` | Change a task's name |
| `move_task` | Move task between lists |
| `postpone_task` | Push due date forward one day |

### Task Properties

| Tool | Description |
|------|-------------|
| `set_priority` | Set priority (1=highest, 2, 3, N=none) |
| `set_due_date` | Set/clear due date (natural language supported) |
| `set_start_date` | Set/clear start date |
| `set_recurrence` | Set repeat pattern (e.g., "every week") |
| `set_estimate` | Set time estimate (e.g., "30 min") |
| `set_url` | Attach a URL to a task |
| `set_location` | Set task location |

### Tags

| Tool | Description |
|------|-------------|
| `get_tags` | Get all tags in your account |
| `add_tags` | Add tags to a task |
| `remove_tags` | Remove tags from a task |
| `set_tags` | Replace all tags on a task |

### Notes

| Tool | Description |
|------|-------------|
| `add_note` | Add a note to a task |
| `edit_note` | Edit an existing note |
| `delete_note` | Delete a note |

### Lists

| Tool | Description |
|------|-------------|
| `get_lists` | Get all lists |
| `create_list` | Create a new list (or Smart List) |
| `rename_list` | Rename a list |
| `archive_list` | Archive a list |
| `delete_list` | Permanently delete a list |

### Other

| Tool | Description |
|------|-------------|
| `get_locations` | Get all saved locations |
| `get_settings` | Get user's RTM settings |

## HTTP Endpoints

### MCP Protocol

- `POST /mcp` - Streamable HTTP MCP endpoint (requires `Accept: application/json, text/event-stream`)
- `POST /mcp/json` - JSON-only compatibility endpoint for clients that don't support SSE

### Health & Auth

- `GET /health` - Health check endpoint
- `GET /rtm/start` - Start RTM OAuth flow
- `GET /rtm/callback` - RTM OAuth callback

## Development

### Build System

This project uses [Turbo](https://turbo.build/) for fast, cached builds:

```bash
# Build everything (respects dependency order)
pnpm build

# Build specific app
pnpm --filter @apps/mcp-server build

# Run all dev servers in parallel
pnpm dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Test specific package
pnpm --filter @packages/rtm-client test
```

### Database Migrations

```bash
# Run pending migrations
pnpm migrate

# Refresh generated Kysely types after schema changes
pnpm --filter @packages/db generate

# Create new migration
# Add new .ts file in packages/db/src/migrations/ with format: <UTC_Timestamp>_description.ts
```

### Docker Compose Services

| Service | Description | Port |
|---------|-------------|------|
| `postgres` | PostgreSQL database | 5432 |
| `migrations` | Runs DB migrations (exits after) | - |
| `mcp` | MCP server | 8787 |
| `web` | Next.js web portal | 3000 |

```bash
# Rebuild and restart a specific service
docker compose up --build mcp

# View logs
docker compose logs -f mcp

# Reset database (delete volume)
docker compose down -v
docker compose up -d postgres
```

## Deployment (Railway)

This project is designed to deploy on [Railway](https://railway.app/) with three services:

### Service Configuration

| Service | Root Directory | Watch Patterns |
|---------|---------------|----------------|
| **mcp-server** | `/` | `apps/mcp-server/**`, `packages/**` |
| **web** | `/` | `apps/web/**`, `packages/**` |
| **postgres** | - | Railway managed PostgreSQL |

Each app has a `railway.json` that configures the build and deployment.

### Environment Variables

#### MCP Server (`mcp-server`)

| Variable | Description | Example |
|----------|-------------|----------|
| `RTM_API_KEY` | RTM API key | `abc123...` |
| `RTM_SHARED_SECRET` | RTM shared secret | `xyz789...` |
| `RTM_CALLBACK_URL` | OAuth callback URL | `https://mcp.yourdomain.com/rtm/callback` |
| `DATABASE_URL` | PostgreSQL connection string | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `BETTER_AUTH_SECRET` | Auth encryption secret | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Auth base URL (same as APP_BASE_URL) | `https://mcp.yourdomain.com` |
| `APP_BASE_URL` | Server's public URL | `https://mcp.yourdomain.com` |
| `WEB_APP_URL` | Web portal URL (for CORS) | `https://app.yourdomain.com` |
| `PORT` | Server port | `8787` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `MCP_SERVER_NAME` | Server name in MCP protocol | `rtm-mcp-server` |
| `MCP_SERVER_VERSION` | Server version | `1.0.0` |

#### Web Portal (`web`)

| Variable | Description | Example |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_BASE` | MCP server URL | `https://mcp.yourdomain.com` |

#### PostgreSQL

Use Railway's managed PostgreSQL. Reference its variables in other services:
- `${{Postgres.DATABASE_URL}}`

### Deployment Steps

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Add PostgreSQL**
   - In Railway dashboard, click "+ New" → "Database" → "PostgreSQL"

3. **Add MCP Server Service**
   - Click "+ New" → "GitHub Repo" → Select your repo
   - Set root directory: `/`
   - Railway auto-detects `apps/mcp-server/railway.json`
   - Add environment variables (see table above)
   - Set custom domain if desired

4. **Add Web Service**
   - Click "+ New" → "GitHub Repo" → Select your repo
   - Set root directory: `/`
   - Railway auto-detects `apps/web/railway.json`
   - Add environment variables
   - Set custom domain if desired

5. **Configure Watch Patterns**
   In Railway service settings, ensure "Config as Code" is enabled so the `watchPatterns` in `railway.json` are respected.

6. **Deploy**
   ```bash
   railway up
   ```
   Or push to GitHub and Railway will auto-deploy.

### Domain Setup

Recommended domain structure:
- MCP Server: `mcp.yourdomain.com` or `api.yourdomain.com`
- Web Portal: `app.yourdomain.com` or `yourdomain.com`

Make sure `RTM_CALLBACK_URL`, `BETTER_AUTH_URL`, `APP_BASE_URL`, and `WEB_APP_URL` match your domain configuration.

## API Rate Limits

Remember The Milk allows approximately 1 request per second per user. The `rtm-client` package implements automatic per-user rate limiting with a 1100ms gap between requests (using [Bottleneck](https://www.npmjs.com/package/bottleneck)).

## Architecture Decisions

### Timeline Management

RTM requires "timelines" for write operations. Per RTM best practices, we:
- Create a new timeline per user session
- Cache timelines for 24 hours
- Refresh expired timelines automatically

### Per-User Rate Limiting

Rate limiting is implemented per-user (not globally) to ensure fair access when multiple users are active. Each user gets their own request queue.

### Monorepo Structure

Using pnpm workspaces + Turbo to:
- Share code between MCP server and web portal
- Reuse auth and database packages
- Maintain single source of truth for RTM client
- Enable fast, cached builds

## Resources

- [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- [Remember The Milk API](https://www.rememberthemilk.com/services/api/)
- [BetterAuth Documentation](https://www.better-auth.com/)
- [Kysely Documentation](https://kysely.dev/)
- [Railway Documentation](https://docs.railway.com/)
- [Turbo Documentation](https://turbo.build/)

## License

MIT

---

**Questions?** Open an issue or check the [Discussions](https://github.com/allen-n/rtm-mcp/discussions) tab.
