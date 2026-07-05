FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

# Build shared packages first
COPY tsconfig.base.json ./
COPY packages/ ./packages/
RUN pnpm --filter @clm/shared-types build && pnpm --filter @clm/shared-utils build

# Build backend
COPY apps/backend/ ./apps/backend/
RUN pnpm --filter @clm/backend build

EXPOSE 3001
CMD ["node", "apps/backend/dist/index.js"]
