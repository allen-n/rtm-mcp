#syntax=docker/dockerfile:1

# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies stage  
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/

RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.11.0 --activate

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

# Copy source
COPY . .

# Accept NEXT_PUBLIC_* vars as build args so they are inlined into the client bundle
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Server-side URL for proxying auth requests (e.g. Docker service name, Railway private URL)
ARG API_BASE_INTERNAL
ENV API_BASE_INTERNAL=$API_BASE_INTERNAL

# Fail fast if critical build-time vars are missing.
RUN : "${NEXT_PUBLIC_API_BASE:?NEXT_PUBLIC_API_BASE build arg is required}" \
 && : "${NEXT_PUBLIC_SITE_URL:?NEXT_PUBLIC_SITE_URL build arg is required}" \
 && : "${API_BASE_INTERNAL:?API_BASE_INTERNAL build arg is required}"

# Build the app
RUN pnpm --filter @apps/web build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
