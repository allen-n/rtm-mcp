FROM node:20-slim AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/

RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile

COPY . .

RUN pnpm --filter @apps/web build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app ./

EXPOSE 3000

CMD ["pnpm","--filter","@apps/web","start"]
