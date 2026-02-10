FROM node:20-slim AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/mcp-server/package.json apps/mcp-server/

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

COPY apps/mcp-server/ apps/mcp-server/

RUN pnpm --filter @apps/mcp-server build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/packages/ packages/
COPY --from=base /app/apps/mcp-server/ apps/mcp-server/
COPY --from=base /app/node_modules/ node_modules/

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["pnpm", "--filter", "@apps/mcp-server", "start"]
