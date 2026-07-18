# Free Model Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-model marketplace that discovers OpenRouter free models, lets users enable them in Loom's existing model registry, and routes chat through the existing selector/failover path.

**Architecture:** Extend the current `providers` / `models` registry instead of creating a parallel catalog. OpenRouter catalog sync writes disabled marketplace rows into `models`; enabling a row makes it eligible for the existing selector and routing pipeline.

**Tech Stack:** Fastify, Drizzle/Postgres, Next.js React components, shared TypeScript API contracts, Vitest.

---

### Task 1: Registry Metadata Columns

**Files:**
- Modify: `apps/backend/src/db/schema.ts`
- Create: `apps/backend/src/db/migrations/0005_free_model_marketplace.sql`
- Modify: `packages/shared-types/src/api.ts`

- [ ] Add `sourceType`, `costTier`, `marketplaceStatus`, `lastSyncedAt`, `lastTestedAt`, and `catalogMetadataJson` to the `models` table/schema.
- [ ] Extend `ModelRegistryItem` with the same nullable marketplace fields.
- [ ] Verify backend typecheck.

### Task 2: OpenRouter Free Catalog Sync

**Files:**
- Create: `apps/backend/src/modules/marketplace/openrouter-catalog.ts`
- Create: `apps/backend/src/modules/marketplace/service.ts`
- Create: `apps/backend/src/modules/marketplace/service.test.ts`

- [ ] Fetch `https://openrouter.ai/api/v1/models`.
- [ ] Detect free models using `id.endsWith(":free")` or zero prompt/completion pricing.
- [ ] Normalize model owner, display name, context length, text/vision capability, pricing, and catalog source.
- [ ] Upsert rows into `models` with `sourceType=provider_catalog`, `costTier=free`, `marketplaceStatus=available`, and `adminStatus=disabled` by default.
- [ ] Preserve already-enabled marketplace models as active.

### Task 3: Marketplace API

**Files:**
- Create: `apps/backend/src/modules/marketplace/routes.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `packages/shared-types/src/api.ts`

- [ ] Add `GET /api/v1/marketplace/free-models`.
- [ ] Add `POST /api/v1/marketplace/free-models/sync`.
- [ ] Add `POST /api/v1/marketplace/free-models/:modelId/enable`.
- [ ] Add `POST /api/v1/marketplace/free-models/:modelId/disable`.
- [ ] Register routes in production and test app setup.

### Task 4: Web API and UI

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Modify: `apps/web/src/components/workspace-section-renderer.tsx`

- [ ] Add web client methods for free marketplace list, sync, enable, and disable.
- [ ] Load marketplace data with the Models & API Keys page data.
- [ ] Add a “Free Model Marketplace” panel above the registry list.
- [ ] Enable/disable actions refresh marketplace, registry, selector, and provider status.

### Task 5: Verification

**Commands:**
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web build`

- [ ] Confirm an enabled free model appears in `GET /api/v1/models/selector?mode=chat`.
- [ ] Confirm disabled marketplace models do not appear in the chat selector.

---

## Self Review

- Spec coverage: covers discovery, storage, marketplace API, UI enable/disable, and selector integration through existing registry.
- Scope intentionally excludes background scheduled sync in this first implementation slice; manual sync is included and background jobs can be added after QA validates the model catalog behavior.
- No parallel routing system is introduced; enabled marketplace models use the existing chat routing and failover flow.
