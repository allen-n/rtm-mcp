FROM node:20-slim AS base
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm --filter @apps/mcp-server build

# Production stage
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app ./

EXPOSE 8787

CMD ["pnpm","--filter","@apps/mcp-server","start"]
