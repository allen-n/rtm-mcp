# RTM MCP Server

A Model Context Protocol (MCP) server for Remember The Milk, with a companion web app for OAuth authentication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monorepo                                │
├──────────────────┬──────────────────┬──────────────────────────┤
│   apps/web       │  apps/mcp-server │     packages/*           │
│   (Next.js)      │  (Node.js MCP)   │                          │
│                  │                  │  @packages/auth          │
│  - OAuth UI      │  - MCP protocol  │  @packages/db            │
│  - User mgmt     │  - RTM API calls │  @packages/rtm           │
│  - API keys      │  - SSE transport │  @packages/types         │
│                  │                  │  @packages/rate-limiter  │
└──────────────────┴──────────────────┴──────────────────────────┘
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 9.11+
- Docker & Docker Compose (for local testing)

### Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your RTM API credentials

# Start all services (mirrors production)
docker compose up --build

# Or run individually with Turbo
pnpm dev           # Start all apps in dev mode
pnpm build         # Build all packages and apps
pnpm test          # Run tests across all packages
pnpm lint          # Lint all packages
pnpm typecheck     # Type check all packages
```

### Docker Compose (Recommended)

The Docker Compose setup mirrors production and includes:

| Service | Port | Description |
|---------|------|-------------|
| `web` | 3000 | Next.js web app |
| `mcp` | 3001 | MCP server |
| `db` | 5432 | PostgreSQL database |
| `migrator` | - | Runs DB migrations on startup |

```bash
# Start everything
docker compose up --build

# Rebuild a specific service
docker compose up --build mcp

# View logs
docker compose logs -f mcp

# Reset database
docker compose down -v && docker compose up --build
```

### Turbo Commands

```bash
pnpm dev           # Start web + mcp-server in dev mode
pnpm build         # Build all packages (respects dependency graph)
pnpm test          # Run all tests
pnpm lint          # Lint everything
pnpm typecheck     # Type check everything
pnpm db:migrate    # Run database migrations
pnpm db:generate   # Generate Kysely types from DB schema
```

## Authentication

The app uses [BetterAuth](https://better-auth.com/) with email/password authentication:

1. **User signs up** on the web app with email/password
2. **User connects RTM** via OAuth flow (RTM API key + secret required)
3. **User generates API key** for MCP client authentication
4. **MCP client** uses the API key to authenticate requests

### Auth Flow

```
User → Web App → BetterAuth (email/password)
                    ↓
              RTM OAuth Flow
                    ↓
              Generate API Key
                    ↓
MCP Client → API Key → MCP Server → RTM API
```

## MCP Tools

The MCP server exposes 30+ tools for interacting with Remember The Milk:

### Lists
- `rtm_getLists` - Get all lists
- `rtm_addList` - Create a new list
- `rtm_deleteList` - Delete a list
- `rtm_setListName` - Rename a list
- `rtm_archiveList` / `rtm_unarchiveList` - Archive/unarchive lists

### Tasks
- `rtm_getTasksInList` - Get tasks from a specific list
- `rtm_searchTasks` - Search tasks with RTM's advanced search syntax
- `rtm_addTask` - Create a new task (supports Smart Add parsing)
- `rtm_deleteTask` - Delete a task
- `rtm_completeTask` / `rtm_uncompleteTask` - Mark tasks complete/incomplete
- `rtm_setTaskName` - Rename a task
- `rtm_setTaskDueDate` / `rtm_setTaskDueDateFromText` - Set due dates
- `rtm_setTaskStartDate` / `rtm_setTaskStartDateFromText` - Set start dates
- `rtm_setTaskPriority` - Set priority (1-4 or none)
- `rtm_setTaskEstimate` / `rtm_setTaskEstimateFromText` - Set time estimates
- `rtm_setTaskRecurrence` - Set repeat patterns
- `rtm_setTaskUrl` - Attach a URL
- `rtm_setTaskLocation` - Set location
- `rtm_postponeTask` - Postpone to next day
- `rtm_moveTask` - Move task to different list

### Tags
- `rtm_addTags` / `rtm_removeTags` - Add/remove tags from tasks
- `rtm_getTagList` - Get all tags in use

### Notes
- `rtm_addNote` - Add a note to a task
- `rtm_deleteNote` - Delete a note

### Locations
- `rtm_getLocations` - Get all saved locations

### Utilities
- `rtm_parseText` - Parse natural language using RTM's Smart Add
- `rtm_getSettings` - Get user settings

## Railway Deployment

### Services Overview

| Service | Root Directory | Config File | Dockerfile |
|---------|---------------|-------------|------------|
| Web App | `/` | `apps/web/railway.json` | `apps/web/Dockerfile` |
| MCP Server | `/` | `apps/mcp-server/railway.json` | `apps/mcp-server/Dockerfile` |
| Migrator | `/` | `packages/db/railway.json` | `packages/db/Dockerfile` |
| Postgres | - | Railway managed | - |

### Step-by-Step Setup

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app) and create a new project
   - Connect your GitHub repository

2. **Add PostgreSQL**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

3. **Add Migrator Service** (run this FIRST)
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `/` (leave empty)
   - Set **Config Path**: `packages/db/railway.json`
   - Add variables:
     | Variable | Value |
     |----------|-------|
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   - The migrator runs once on deploy, retries 3x on failure, then exits

4. **Add Web App Service**
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `/` (leave empty)
   - Set **Config Path**: `apps/web/railway.json`
   - Add variables:
     | Variable | Value | Notes |
     |----------|-------|-------|
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference Postgres service |
     | `BETTER_AUTH_SECRET` | (generate secure random) | `openssl rand -base64 32` |
     | `BETTER_AUTH_URL` | `https://your-app.railway.app` | Your web app URL |
     | `RTM_API_KEY` | (from RTM) | Get from rememberthemilk.com/services/api/keys.rtm |
     | `RTM_API_SECRET` | (from RTM) | Get from RTM API dashboard |

5. **Add MCP Server Service**
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `/` (leave empty)  
   - Set **Config Path**: `apps/mcp-server/railway.json`
   - Add variables:
     | Variable | Value | Notes |
     |----------|-------|-------|
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference Postgres service |
     | `RTM_API_KEY` | (from RTM) | Same as web app |
     | `RTM_API_SECRET` | (from RTM) | Same as web app |
     | `BETTER_AUTH_SECRET` | (same as web) | Must match web app |
     | `PORT` | `3001` | Or let Railway assign |

6. **Configure Domains**
   - Web App: Generate domain or add custom (e.g., `app.yourdomain.com`)
   - MCP Server: Generate domain or add custom (e.g., `mcp.yourdomain.com`)

### Watch Patterns

Each service only rebuilds when relevant files change:

| Service | Watches |
|---------|--------|
| Web App | `apps/web/**`, `packages/**`, `pnpm-lock.yaml` |
| MCP Server | `apps/mcp-server/**`, `packages/**`, `pnpm-lock.yaml` |
| Migrator | `packages/db/**` |

### Deployment Order

Railway deploys services in parallel. The migrator has built-in retry logic (`waitForDatabase`) that waits for Postgres to be ready. Services will retry connections if migrations haven't completed yet.

For first-time setup, you may want to:
1. Deploy Postgres first
2. Deploy Migrator and wait for it to complete
3. Then deploy Web + MCP

### Troubleshooting

**Migrator keeps restarting:**
- Check logs for migration errors
- Verify `DATABASE_URL` is correctly referencing Postgres
- The migrator uses `restartPolicyType: ON_FAILURE` with max 3 retries

**Web/MCP can't connect to DB:**
- Ensure `DATABASE_URL` uses Railway's variable reference syntax: `${{Postgres.DATABASE_URL}}`
- Check that Postgres service is running

**Build failures:**
- Ensure root directory is empty (not `/apps/web`)
- Config path should point to the `railway.json` file

## Environment Variables

### Required for All Services

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |

### Web App Specific

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Secret for session encryption |
| `BETTER_AUTH_URL` | Public URL of web app |
| `RTM_API_KEY` | Remember The Milk API key |
| `RTM_API_SECRET` | Remember The Milk API secret |

### MCP Server Specific

| Variable | Description |
|----------|-------------|
| `RTM_API_KEY` | Remember The Milk API key |
| `RTM_API_SECRET` | Remember The Milk API secret |
| `BETTER_AUTH_SECRET` | Must match web app for API key validation |
| `PORT` | Server port (default: 3001) |

## Project Structure

```
.
├── apps/
│   ├── mcp-server/          # MCP server (Node.js)
│   │   ├── src/
│   │   │   ├── mcp.ts       # MCP server setup
│   │   │   ├── tools/       # Individual tool implementations
│   │   │   └── index.ts     # Entry point
│   │   ├── Dockerfile
│   │   └── railway.json
│   └── web/                 # Next.js web app
│       ├── app/             # App router pages
│       ├── components/      # React components
│       ├── Dockerfile
│       └── railway.json
├── packages/
│   ├── auth/                # BetterAuth configuration
│   ├── db/                  # Database schema & migrations
│   │   ├── src/
│   │   │   ├── kysely.ts    # Kysely client
│   │   │   ├── migrator.ts  # Migration runner
│   │   │   └── migrations/  # SQL migrations
│   │   ├── Dockerfile
│   │   └── railway.json
│   ├── rate-limiter/        # Per-user rate limiting (Bottleneck)
│   ├── rtm/                 # RTM API client
│   └── types/               # Shared TypeScript types
├── docker-compose.yml       # Local development
├── turbo.json              # Turborepo configuration
└── pnpm-workspace.yaml     # pnpm workspace config
```

## License

MIT
