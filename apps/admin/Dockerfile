# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @meddexa/admin...
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN pnpm --filter @meddexa/shared build && cd apps/admin && NEXT_TELEMETRY_DISABLED=1 npx next build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /repo/apps/admin/public ./apps/admin/public
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
