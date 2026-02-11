FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS build
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy the db package
COPY packages/db ./packages/db

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the migrator
RUN pnpm --filter @packages/db build

# Production stage
FROM base AS production
WORKDIR /app

# Copy built output and dependencies
COPY --from=build --chown=node:node /app/packages/db/dist ./dist
COPY --from=build --chown=node:node /app/packages/db/migrations ./migrations
COPY --from=build --chown=node:node /app/packages/db/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Run as non-root user
USER node

# Run migrations
CMD ["node", "dist/migrator.js"]
