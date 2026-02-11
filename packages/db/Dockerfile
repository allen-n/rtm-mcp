FROM node:22-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy the db package
COPY packages/db ./packages/db

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the migrator
RUN pnpm --filter @packages/db build

# Run as non-root user
USER node

# Run migrations
CMD ["node", "packages/db/dist/migrator.js"]
