# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --filter @meddexa/api... 
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @meddexa/shared build \
 && cd apps/api && npx prisma generate && npx nest build

FROM node:22-bookworm-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3000
# Apply pending migrations, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
