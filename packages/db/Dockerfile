FROM node:20-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace files for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/ packages/db/

# Install all dependencies (including dev for building)
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm --filter @packages/db build

# Deploy to isolated directory with prod deps only
RUN pnpm --filter @packages/db --prod deploy /app/deployed

# Production image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/deployed ./

USER node

CMD ["node", "dist/migrator.js"]
