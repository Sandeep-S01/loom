# Milestone 2 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only dashboard landing page with a backend-computed `GET /api/v1/dashboard` read model and move the existing chat UI to `/chat`.

**Architecture:** Add a small backend dashboard module that aggregates recent conversations, recent agent runs, active workspace, companion state, and provider summary from PostgreSQL plus Redis-backed ephemeral state. Split the web app into a dashboard route at `/` and a reused chat route at `/chat`, using focused dashboard components and keeping the existing chat shell intact.

**Tech Stack:** Fastify, TypeScript, Drizzle ORM, PostgreSQL, Redis key helpers, Next.js App Router, React 19, Tailwind CSS, Vitest

---

### Task 1: Add Shared Dashboard API Contracts

**Files:**
- Modify: `packages/shared-types/src/api.ts`
- Test: `packages/shared-types`

- [ ] **Step 1: Add dashboard-specific response contracts to shared types**

```ts
export interface DashboardConversationItem {
  id: string;
  mode: "chat" | "agent";
  title: string;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface DashboardRunItem {
  id: string;
  conversationId: string;
  workspaceId: string;
  objective: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWorkspaceItem {
  id: string;
  alias: string;
  status: string;
  displayPathHint: string | null;
  lastUsedAt: string | null;
}

export interface DashboardResponse {
  recentConversations: DashboardConversationItem[];
  recentAgentRuns: DashboardRunItem[];
  activeWorkspace: DashboardWorkspaceItem | null;
  companion: {
    connected: boolean;
    machineLabel: string | null;
  };
  providerSummary: {
    eligibleCount: number;
    cooldownCount: number;
    lastExhaustedAt: string | null;
  };
}
```

- [ ] **Step 2: Run the shared-types build**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

- [ ] **Step 3: Run the shared-types typecheck**

Run: `pnpm --filter @clm/shared-types typecheck`
Expected: PASS

- [ ] **Step 4: Checkpoint the shared contract update**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS again after contract review

### Task 2: Build Backend Dashboard Repository And Service

**Files:**
- Create: `apps/backend/src/modules/dashboard/repository.ts`
- Create: `apps/backend/src/modules/dashboard/service.ts`
- Create: `apps/backend/src/modules/dashboard/routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/modules/dashboard/service.test.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Write the failing dashboard service tests**

```ts
import { describe, expect, it } from "vitest";

describe("dashboard service", () => {
  it("returns an empty-state payload when no data exists", async () => {
    expect(true).toBe(false);
  });

  it("orders recent conversations newest first", async () => {
    expect(true).toBe(false);
  });

  it("falls back to disconnected companion state when no redis state exists", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the backend tests to verify the new dashboard scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing dashboard module or intentional failing assertions

- [ ] **Step 3: Add the dashboard repository for recent conversations, runs, and workspace**

```ts
export interface DashboardRepository {
  listRecentConversations(userId: string): Promise<DashboardConversationItem[]>;
  listRecentAgentRuns(userId: string): Promise<DashboardRunItem[]>;
  getActiveWorkspace(userId: string): Promise<DashboardWorkspaceItem | null>;
}

export function createInMemoryDashboardRepository(): DashboardRepository {
  return {
    async listRecentConversations() {
      return [];
    },
    async listRecentAgentRuns() {
      return [];
    },
    async getActiveWorkspace() {
      return null;
    },
  };
}
```

- [ ] **Step 4: Add the dashboard service with conservative companion/provider fallbacks**

```ts
export function createDashboardService(options: CreateDashboardServiceOptions) {
  return {
    async getDashboard(userId: string): Promise<DashboardResponse> {
      const [recentConversations, recentAgentRuns, activeWorkspace] =
        await Promise.all([
          options.repository.listRecentConversations(userId),
          options.repository.listRecentAgentRuns(userId),
          options.repository.getActiveWorkspace(userId),
        ]);

      const companion = await options.getCompanionState().catch(() => ({
        connected: false,
        machineLabel: null,
      }));

      const providerSummary = await options.getProviderSummary().catch(() => ({
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      }));

      return {
        recentConversations,
        recentAgentRuns,
        activeWorkspace,
        companion,
        providerSummary,
      };
    },
  };
}
```

- [ ] **Step 5: Register `GET /api/v1/dashboard` in the backend app**

```ts
await scopedApp.register(
  async (dashboardApp) => {
    await registerDashboardRoutes(dashboardApp, {
      dashboardService,
    });
  },
  {
    prefix: "/api/v1/dashboard",
  },
);
```

- [ ] **Step 6: Re-run backend tests for the dashboard service and route**

Run: `pnpm --filter @clm/backend test`
Expected: PASS for dashboard service tests and route-level empty-state checks

- [ ] **Step 7: Run backend typecheck**

Run: `pnpm --filter @clm/backend typecheck`
Expected: PASS

### Task 3: Add Real Provider Summary And Companion State Resolvers

**Files:**
- Modify: `apps/backend/src/modules/dashboard/service.ts`
- Modify: `apps/backend/src/modules/providers/repository.ts`
- Modify: `apps/backend/src/redis/keys.ts`
- Test: `apps/backend/src/modules/dashboard/service.test.ts`

- [ ] **Step 1: Add the failing test for provider summary counts**

```ts
it("counts eligible and cooldown models correctly", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: Run the backend tests to verify provider summary behavior is still failing**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing provider summary implementation

- [ ] **Step 3: Add repository helpers for provider-model catalog reads**

```ts
export async function listDashboardProviderModels() {
  return db
    .select({
      providerId: providers.id,
      modelId: models.id,
      active: models.active,
      supportsChat: models.supportsChat,
      supportsAgent: models.supportsAgent,
      providerStatus: providers.status,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id));
}
```

- [ ] **Step 4: Add companion/provider summary resolvers used by the dashboard service**

```ts
async function getCompanionState(): Promise<{ connected: boolean; machineLabel: string | null }> {
  return {
    connected: false,
    machineLabel: null,
  };
}

async function getProviderSummary(): Promise<DashboardResponse["providerSummary"]> {
  const models = await listDashboardProviderModels();
  const eligibleCount = models.filter((item) => item.active && item.providerStatus !== "disabled").length;

  return {
    eligibleCount,
    cooldownCount: 0,
    lastExhaustedAt: null,
  };
}
```

- [ ] **Step 5: Re-run backend tests after adding summary logic**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

- [ ] **Step 6: Run the backend build**

Run: `pnpm --filter @clm/backend build`
Expected: PASS

### Task 4: Split The Web App Into Dashboard And Chat Routes

**Files:**
- Create: `apps/web/src/app/chat/page.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Test: `apps/web` build and typecheck commands

- [ ] **Step 1: Verify the current web app still builds before the route split**

Run: `pnpm --filter @clm/web build`
Expected: PASS

- [ ] **Step 2: Create a dedicated `/chat` page that reuses the existing chat shell**

```tsx
import { ChatShell } from "../../components/chat-shell";

export default function ChatPage() {
  return (
    <main className="min-h-screen">
      <ChatShell />
    </main>
  );
}
```

- [ ] **Step 3: Replace the root page with a dashboard page shell**

```tsx
import { DashboardShell } from "../components/dashboard-shell";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <DashboardShell />
    </main>
  );
}
```

- [ ] **Step 4: Run web typecheck after the route split**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

- [ ] **Step 5: Run the web build after the route split**

Run: `pnpm --filter @clm/web build`
Expected: PASS

### Task 5: Build Dashboard UI Components And API Client Calls

**Files:**
- Create: `apps/web/src/components/dashboard-shell.tsx`
- Create: `apps/web/src/components/dashboard-card.tsx`
- Create: `apps/web/src/components/recent-conversations-panel.tsx`
- Create: `apps/web/src/components/recent-agent-runs-panel.tsx`
- Create: `apps/web/src/components/provider-summary-card.tsx`
- Create: `apps/web/src/components/companion-status-card.tsx`
- Create: `apps/web/src/components/active-workspace-card.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`
- Test: `apps/web` build and typecheck commands

- [ ] **Step 1: Add a dashboard API client function**

```ts
export function getDashboard() {
  return request<DashboardResponse>("/api/v1/dashboard");
}
```

- [ ] **Step 2: Add the dashboard shell with fetch-on-load behavior**

```tsx
"use client";

export function DashboardShell() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getDashboard()
      .then(setDashboard)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      });
  }, []);

  return <div>{dashboard ? "loaded" : error ?? "Loading dashboard..."}</div>;
}
```

- [ ] **Step 3: Add the read-only dashboard cards and panels**

```tsx
<div className="grid gap-4 md:grid-cols-3">
  <CompanionStatusCard companion={dashboard.companion} />
  <ActiveWorkspaceCard workspace={dashboard.activeWorkspace} />
  <ProviderSummaryCard providerSummary={dashboard.providerSummary} />
</div>

<div className="mt-6 grid gap-4 lg:grid-cols-2">
  <RecentConversationsPanel conversations={dashboard.recentConversations} />
  <RecentAgentRunsPanel runs={dashboard.recentAgentRuns} />
</div>
```

- [ ] **Step 4: Add lightweight navigation from the dashboard to `/chat`**

```tsx
<Link
  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
  href="/chat"
>
  Open Chat
</Link>
```

- [ ] **Step 5: Re-run web typecheck**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

- [ ] **Step 6: Re-run web build**

Run: `pnpm --filter @clm/web build`
Expected: PASS

### Task 6: Add Backend Route Coverage For Empty And Populated Dashboard States

**Files:**
- Modify: `apps/backend/src/app.test.ts`
- Modify: `apps/backend/src/modules/dashboard/service.test.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Add the failing route-level dashboard tests**

```ts
it("returns an empty dashboard payload for a new session", async () => {
  expect(true).toBe(false);
});

it("returns recent conversations ordered newest first", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: Run the backend tests to verify the new route coverage fails**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing route assertions or ordering gaps

- [ ] **Step 3: Tighten repository ordering and route wiring until the route tests pass**

```ts
const recentConversations = await options.repository.listRecentConversations(userId);

return {
  recentConversations: recentConversations.slice(0, 5),
  recentAgentRuns: recentRuns.slice(0, 5),
  activeWorkspace,
  companion,
  providerSummary,
};
```

- [ ] **Step 4: Re-run backend tests**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

- [ ] **Step 5: Run backend typecheck**

Run: `pnpm --filter @clm/backend typecheck`
Expected: PASS

### Task 7: Run Repository-Wide Verification For The Dashboard Slice

**Files:**
- Modify: `apps/backend/src/modules/dashboard/*`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/chat/page.tsx`
- Test: repository verification commands

- [ ] **Step 1: Build shared-types**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

- [ ] **Step 2: Run backend tests and build**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

Run: `pnpm --filter @clm/backend build`
Expected: PASS

- [ ] **Step 3: Run web typecheck and build**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

Run: `pnpm --filter @clm/web build`
Expected: PASS

- [ ] **Step 4: Run workspace typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Run workspace test**

Run: `pnpm test`
Expected: PASS for the packages that currently define tests
