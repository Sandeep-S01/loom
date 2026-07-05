# Loom

Loom is a single-user AI workspace for chat, model routing, companion pairing, and local workspaces.

## Monorepo Structure

- `apps/web` - Next.js workspace UI
- `apps/backend` - Fastify API, session flow, provider routing, companion and workspace endpoints
- `apps/companion` - Tauri desktop companion
- `packages/shared-types` - shared API and domain types
- `packages/shared-utils` - shared helpers
- `docs` - product, architecture, and implementation docs

## Stack

- `pnpm` workspaces
- `turbo`
- `Next.js`
- `Fastify`
- `Drizzle ORM`
- `Postgres`
- `Redis`
- `Tauri`

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment config:

```bash
cp .env.example .env
```

3. Start the apps you need:

```bash
pnpm dev
```

Useful targeted commands:

```bash
pnpm --filter @clm/web dev
pnpm --filter @clm/backend dev
pnpm --filter @clm/companion dev
```

## Verification

Run the standard checks before pushing:

```bash
pnpm typecheck
pnpm build
pnpm test
```

## Environment Notes

- `.env` is local-only and must not be committed
- OpenRouter and database credentials belong only in local or deployment environment config

## Workflow

- keep `main` stable
- create short-lived feature branches
- verify locally before push
- avoid committing generated logs, build output, or incremental cache files
