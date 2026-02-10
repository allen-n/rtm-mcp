#syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

FROM base AS build
WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# Build all workspace packages (tsc for mcp-server)
RUN pnpm --filter @apps/mcp-server build

# Deploy with production dependencies
RUN pnpm --filter @apps/mcp-server --prod deploy /prod/mcp-server

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcp

COPY --from=build --chown=mcp:nodejs /prod/mcp-server .

USER mcp

EXPOSE 8787

CMD ["node", "dist/index.cjs"]
