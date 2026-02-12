# AGENTS.md -- Context for AI coding agents

This file captures architectural knowledge, conventions, and hard-won lessons
about this codebase so that future AI agents (and humans) avoid repeating
mistakes.

---

## 1. Project overview

**MCP-RTM** is a Model Context Protocol server that bridges AI assistants to
Remember The Milk (RTM). It ships with a Next.js web portal for user
registration, RTM OAuth, and API-key management.

- **Production domains:** `milkbridge.dev` (web), `api.milkbridge.dev` (MCP server)
- **Hosting:** Railway (Docker-based deploys, managed Postgres)
- **Package manager:** pnpm 9 with workspaces
- **Build system:** Turborepo

---

## 2. Monorepo layout

```
apps/
  mcp-server/          Hono HTTP server + MCP SDK (Node.js)
  web/                 Next.js 15 web portal (React 18, Tailwind, shadcn/ui)

packages/
  auth/                BetterAuth config (server.ts + client.ts + types)
  db/                  Kysely ORM, Postgres migrations, type codegen
  rtm-client/          RTM REST API wrapper with per-user rate limiting (Bottleneck)
```

Workspace references use `workspace:*` / `workspace:^`.
Path aliases: `@auth/*`, `@db/*`, `@rtm-client/*` (defined in `tsconfig.base.json`).

---

## 3. Tech stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| MCP server       | Hono 4 + `@hono/mcp` + `@modelcontextprotocol/sdk` |
| Web portal       | Next.js 15 (App Router, standalone output)         |
| Auth             | BetterAuth (email/password + API-key plugin)       |
| Database         | PostgreSQL 16 via Kysely (raw SQL migrations)      |
| UI               | Tailwind CSS 3, shadcn/ui (Radix primitives)       |
| Rate limiting    | Bottleneck (per-user, 1 req/s for RTM API)         |
| Containerisation | Docker multi-stage builds, docker-compose          |

---

## 4. Key files and their roles

| File                                 | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/mcp-server/src/http.ts`        | Hono app: CORS, session middleware, auth routes, MCP endpoints                                |
| `apps/mcp-server/src/mcp.ts`         | MCP tool/resource/prompt definitions                                                          |
| `apps/mcp-server/src/routes/auth.ts` | RTM OAuth flow (`/rtm/start`, `/rtm/callback`, `/rtm/status`, `/rtm/disconnect`)              |
| `apps/web/next.config.mjs`           | Next.js config including `rewrites()` that proxy `/api/auth/*` and `/rtm/*` to the MCP server |
| `apps/web/Dockerfile`                | Multi-stage Docker build with `ARG` declarations for build-time env vars                      |
| `packages/auth/src/server.ts`        | BetterAuth server config (cookie policy, trustedOrigins, plugins)                             |
| `packages/auth/src/client.ts`        | BetterAuth React client (no `baseURL` -- relies on same-origin proxy)                         |
| `packages/db/src/kysely.ts`          | Database connection pool                                                                      |
| `packages/db/src/migrations/`        | Timestamped Kysely migrations                                                                 |
| `docker-compose.yml`                 | Local dev: postgres, migrations, mcp, web services                                            |
| `turbo.json`                         | Turborepo task pipeline                                                                       |

---

## 5. Architecture patterns

### 5.1 Auth proxy (critical)

The web portal **never** makes cross-origin requests to the MCP server from the
browser. All auth and RTM endpoints are proxied through Next.js `rewrites()`:

```
Browser -> milkbridge.dev/api/auth/* -> (Next.js proxy) -> api.milkbridge.dev/api/auth/*
Browser -> milkbridge.dev/rtm/*      -> (Next.js proxy) -> api.milkbridge.dev/rtm/*
```

This eliminates CORS issues and allows `sameSite: "lax"` cookies (no need for
`sameSite: "none"` + `secure`). The proxy destination is configured via
`API_BASE_INTERNAL` (build-time) with fallback to `NEXT_PUBLIC_API_BASE`.

**Rule:** If you add a new server endpoint that the browser needs to call,
add a matching `rewrites()` entry in `next.config.mjs` and use a same-origin
path in the client code. Never have the browser fetch directly from
`api.milkbridge.dev`.

### 5.2 MCP transport

Two endpoints:

- `POST /mcp` -- Streamable HTTP (SSE) for full MCP clients
- `POST /mcp/json` -- JSON-only "relaxed" transport for clients that don't support SSE

Both require authentication (API key via `x-api-key` header, or session cookie).

### 5.3 Database

- Kysely with raw SQL migrations in `packages/db/src/migrations/`.
- After changing the schema, run `pnpm migrate` (builds db package, runs migrator, regenerates types).
- BetterAuth uses the same Postgres pool (`packages/db/src/kysely.ts`) -- it auto-detects the pool type.
- Column naming is **snake_case** in Postgres; BetterAuth field mappings convert from its camelCase defaults (see `packages/auth/src/server.ts`).

---

## 6. Environment variable gotchas

This is the single most common source of production bugs. Read carefully.

### 6.1 Build-time vs runtime

Next.js has two categories of env vars:

| Category                                        | When evaluated                                  | Example                |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------- |
| `NEXT_PUBLIC_*`                                 | **Build time** -- inlined into client JS bundle | `NEXT_PUBLIC_API_BASE` |
| `rewrites()` return value                       | **Build time** -- baked into routes manifest    | `API_BASE_INTERNAL`    |
| Everything else (server components, API routes) | Runtime                                         | `DATABASE_URL`         |

**Consequence:** `NEXT_PUBLIC_*` and `API_BASE_INTERNAL` must be available when
`next build` runs. In the Dockerfile, they are declared as `ARG` + `ENV` before
the `RUN pnpm ... build` step. Railway automatically passes service variables as
Docker build args when a matching `ARG` is declared.

If you add a new env var that is needed at build time, you **must** add a
corresponding `ARG`/`ENV` pair in `apps/web/Dockerfile`.

### 6.2 Docker networking

Inside Docker Compose, services reach each other by service name (e.g.
`http://mcp:8787`), not `localhost`. The `API_BASE_INTERNAL` var handles this:

- Docker Compose: `http://mcp:8787`
- Railway: `http://<service>.railway.internal:<port>` (private networking)
- Native local dev: unset (falls back to `NEXT_PUBLIC_API_BASE` = `http://localhost:8787`)

### 6.3 Railway-specific

- **Never override `PORT`** on Railway. Railway assigns its own port and sets
  `PORT` automatically. Overriding it causes 502s.
- **Private networking uses `http://`, not `https://`.** Railway internal URLs
  do not use TLS.
- The port in `API_BASE_INTERNAL` must match what Railway actually assigns to
  the mcp service (check deploy logs -- it's often `8080`, not `8787`).
- `WEB_APP_URL` on the mcp-server service must match the browser's origin
  exactly (e.g. `https://milkbridge.dev`, no trailing slash). This feeds
  BetterAuth's `trustedOrigins`. Getting it wrong causes `403 Invalid origin`.

---

## 7. Commit message conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <imperative summary>

<optional body explaining WHY, not just what>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

Examples from this repo:

```
fix: proxy auth requests through Next.js to eliminate CORS errors
fix: pass NEXT_PUBLIC_API_BASE as Docker build arg so it's inlined into Next.js client bundle
feat: Improve MCP deploy packaging and refresh web branding (#5)
chore: update .env.example with all required variables
```

---

## 8. Development workflow

### Local dev (native, fastest iteration)

```bash
docker compose up -d postgres     # start just Postgres
pnpm migrate                      # run migrations
pnpm dev                          # starts mcp-server + web via Turbo
```

### Local dev (Docker, mirrors production)

```bash
docker compose up --build
```

### Running tests

```bash
pnpm test              # vitest, runs from repo root
pnpm test:watch        # watch mode
```

### Building

```bash
pnpm build             # Turbo builds all packages in dependency order
```

---

## 9. Common pitfalls and debugging

| Symptom                            | Cause                                                       | Fix                                                                         |
| ---------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Auth hits `localhost:8787` in prod | `NEXT_PUBLIC_API_BASE` missing at build time                | Add `ARG` in Dockerfile, redeploy                                           |
| CORS errors on auth endpoints      | Browser making direct cross-origin requests                 | Use Next.js `rewrites()` proxy, fetch from same origin                      |
| `ECONNREFUSED` from Next.js proxy  | `API_BASE_INTERNAL` wrong (wrong scheme, port, or hostname) | Verify: `http://` not `https://`, correct port, private networking enabled  |
| `403 Invalid origin` on sign-up    | `WEB_APP_URL` mismatch on mcp service                       | Set to exact browser origin (`https://milkbridge.dev`)                      |
| `502 Bad Gateway` on custom domain | `PORT` env var overridden on Railway                        | Remove `PORT` override, let Railway set it                                  |
| Cookie not sent on auth requests   | `sameSite: "none"` without proxy, or cross-origin fetch     | Proxy through Next.js, use `sameSite: "lax"`                                |
| Env var changes not taking effect  | Build-time var cached in Docker layer or Next.js bundle     | Force rebuild: `docker compose build --no-cache web` or redeploy on Railway |

---

## 10. Code style and preferences

- **TypeScript** everywhere, strict mode enabled.
- **ES modules** (`"type": "module"` in all packages). Use `.js` extensions in
  relative imports within the mcp-server (required by Node.js ESM resolution).
- **No default exports** in library packages. Named exports only.
- **Path aliases** (`@auth/*`, `@db/*`) for cross-package imports.
- **shadcn/ui** component pattern in the web app (`components/ui/`). Do not
  install full component libraries -- copy individual components via the shadcn CLI.
- Database columns are **snake_case**. TypeScript types are **camelCase**.
  BetterAuth field mappings bridge the two.

---

## 11. Deployment checklist

When deploying a new feature or fix:

1. Ensure all build-time env vars have `ARG`/`ENV` in `apps/web/Dockerfile`
2. Verify `rewrites()` in `next.config.mjs` if adding new browser-facing endpoints
3. Check `trustedOrigins` in `packages/auth/src/server.ts` if changing domains
4. Check CORS config in `apps/mcp-server/src/http.ts` if adding new origins
5. Verify `WEB_APP_URL` on the mcp Railway service matches the web domain
6. Do **not** set `PORT` on Railway services
7. Use `http://` (not `https://`) for `API_BASE_INTERNAL` on Railway

---

## 12. Adding new MCP tools

1. Define the tool in `apps/mcp-server/src/mcp.ts` using the MCP SDK's `server.tool()` API
2. The tool handler receives a `params` object and must return MCP-compliant content
3. Use `withTransportUserContext` to access the authenticated user's RTM client
4. RTM API calls go through `packages/rtm-client` which handles per-user rate limiting
5. Add corresponding tests if the tool has complex logic

---

## 13. Adding new web pages

1. Create a new directory under `apps/web/app/` (App Router convention)
2. Use `"use client"` directive for interactive pages
3. Auth check: call `authClient.getSession()` in `useEffect`, redirect to `/login` if no session
4. For API calls to the MCP server, use same-origin paths (e.g. `/rtm/status`) -- never construct URLs with `NEXT_PUBLIC_API_BASE` for fetch calls
5. `NEXT_PUBLIC_API_BASE` (`publicApiBase`) is only for **display purposes** (showing the MCP server URL to the user for their Claude config)


## Notes from general agents context that may be available to you

The following tools are available for various tasks:

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## Code Search

You run in an environment where `ast-grep` is available; whenever a search can reasonably use it, or requires syntax-aware or structural matching, default to `ast-grep --lang rust -p '<pattern>'` (or set `--lang` appropriately) and avoid falling back to text-only tools like `rg` or `grep` unless I explicitly request a plain-text search. You should only use `rg` or `grep` if `ast-grep` cannot handle the search. If you use `ast-grep`, ensure that the pattern is syntactically valid for the specified language. If you're unsure about the syntax, ask me for clarification before proceeding.

## Code Documentation

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
