FROM node:20-slim AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/

RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile

COPY . .

RUN pnpm --filter @apps/web build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/package.json ./apps/web/package.json
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=base /app/packages ./packages
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml

EXPOSE 3000

CMD ["node","node_modules/next/dist/bin/next","start","-p","3000"]
