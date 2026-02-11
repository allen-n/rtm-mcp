# MCP Server Dockerfile
# Note: Railway uses RAILPACK (see railway.json). This Dockerfile is for local Docker builds.

FROM node:20-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace files for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/mcp-server/tsup.config.ts apps/mcp-server/
COPY apps/mcp-server/tsconfig.json apps/mcp-server/

# Install all dependencies (including dev for building)
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/mcp-server/src/ apps/mcp-server/src/
RUN pnpm --filter @apps/mcp-server build

# Deploy to isolated directory with prod deps only
RUN pnpm --filter @apps/mcp-server --prod deploy /app/deployed

# Production image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy deployed package (includes dist/ and prod node_modules)
# Use --chown to ensure the node user can read the files
COPY --from=builder --chown=node:node /app/deployed ./

# Run as non-root user for security (node user is built into node:20-slim)
USER node

EXPOSE 8787

# Note: fetch() requires Node.js 18+. This image uses node:20-slim.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
