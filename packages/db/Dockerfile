FROM node:20-slim

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.11.0 --activate

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db ./packages/db

# Switch to non-root user
USER node

# Run migrations only (no type generation in prod)
CMD ["pnpm", "--filter", "@packages/db", "migrate:prod"]
