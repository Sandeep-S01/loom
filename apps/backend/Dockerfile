FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/
RUN pnpm --filter @clm/shared-types build \
  && pnpm --filter @clm/shared-utils build \
  && pnpm --filter @clm/backend build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=node:node /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build --chown=node:node /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build --chown=node:node /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=build --chown=node:node /app/packages/shared-utils/package.json ./packages/shared-utils/package.json

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health/live >/dev/null || exit 1
CMD ["node", "apps/backend/dist/index.js"]
