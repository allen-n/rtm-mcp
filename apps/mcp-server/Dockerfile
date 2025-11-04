FROM node:22-slim AS base
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/rtm-client/package.json ./packages/rtm-client/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm --filter @apps/mcp-server build

# Production stage
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=base /app/apps/mcp-server/package.json ./apps/mcp-server/package.json
COPY --from=base /app/packages ./packages
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml

EXPOSE 8787

CMD ["node","apps/mcp-server/dist/index.js"]
