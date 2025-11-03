FROM node:20-slim
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@9.11.0 --activate
RUN pnpm i --frozen-lockfile
CMD ["pnpm","--filter","@packages/db","migrate"]
