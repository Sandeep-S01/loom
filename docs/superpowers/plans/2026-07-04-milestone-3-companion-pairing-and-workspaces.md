# Milestone 3 Companion Pairing And Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full V1 pairing and workspace-registration flow across backend, web, and Tauri companion so a desktop user can connect a local machine and register a project folder for later agent use.

**Architecture:** Add backend `companion` and `workspaces` modules for pairing challenges, machine registration, companion status, and workspace persistence; extend the web app with a desktop pairing/workspace surface; and extend the Tauri companion with pairing UI, token exchange, and workspace registration after folder selection.

**Tech Stack:** Fastify, TypeScript, Drizzle ORM, PostgreSQL, Redis, Next.js App Router, React 19, Tauri 2, Rust commands, shared types

---

### Task 1: Add Shared API Contracts For Pairing And Workspaces

**Files:**
- Modify: `packages/shared-types/src/api.ts`
- Test: `packages/shared-types`

- [ ] **Step 1: Add companion pairing and workspace DTOs**

```ts
export interface PairStartResponse {
  pairingCode: string;
  expiresAt: string;
}

export interface PairCompleteRequest {
  pairingCode: string;
  machineLabel: string;
  machineFingerprintHash: string;
}

export interface PairCompleteResponse {
  deviceId: string;
  machineSessionToken: string;
}

export interface CompanionStatusResponse {
  connected: boolean;
  machineLabel: string | null;
  deviceId: string | null;
}

export interface WorkspaceListItem {
  id: string;
  alias: string;
  machineId: string;
  status: string;
  displayPathHint: string | null;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceListItem[];
}

export interface SelectWorkspaceRequest {
  machineId: string;
  alias: string;
  canonicalPathHash: string;
  displayPathHint?: string;
}

export interface SelectWorkspaceResponse {
  workspace: WorkspaceListItem;
}
```

- [ ] **Step 2: Run shared-types build**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

- [ ] **Step 3: Run shared-types typecheck**

Run: `pnpm --filter @clm/shared-types typecheck`
Expected: PASS

- [ ] **Step 4: Re-run shared-types build as checkpoint**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

### Task 2: Build Backend Companion Pairing Endpoints

**Files:**
- Create: `apps/backend/src/modules/companion/repository.ts`
- Create: `apps/backend/src/modules/companion/service.ts`
- Create: `apps/backend/src/modules/companion/routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/modules/companion/service.test.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Write failing tests for pairing challenge creation and completion**

```ts
describe("companion pairing", () => {
  it("creates a short-lived pairing challenge", async () => {
    expect(true).toBe(false);
  });

  it("rejects an expired pairing code", async () => {
    expect(true).toBe(false);
  });

  it("completes pairing and returns machine credentials", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run backend tests to verify the new pairing scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing companion module behavior

- [ ] **Step 3: Add a companion repository for device persistence and pairing challenge storage**

```ts
export interface CompanionRepository {
  createPairingChallenge(userId: string): Promise<PairStartResponse>;
  completePairing(input: PairCompleteRequest): Promise<PairCompleteResponse>;
  getCompanionStatus(userId: string): Promise<CompanionStatusResponse>;
}
```

- [ ] **Step 4: Add the companion service with challenge validation and device upsert behavior**

```ts
export function createCompanionService(options: CreateCompanionServiceOptions) {
  return {
    async startPairing(userId: string) {
      return options.repository.createPairingChallenge(userId);
    },
    async completePairing(input: PairCompleteRequest) {
      return options.repository.completePairing(input);
    },
    async getStatus(userId: string) {
      return options.repository.getCompanionStatus(userId);
    },
  };
}
```

- [ ] **Step 5: Register companion routes in `app.ts`**

```ts
await scopedApp.register(
  async (companionApp) => {
    await registerCompanionRoutes(companionApp, {
      companionService,
    });
  },
  {
    prefix: "/api/v1/companion",
  },
);
```

- [ ] **Step 6: Re-run backend tests for companion pairing**

Run: `pnpm --filter @clm/backend test`
Expected: PASS for pairing challenge and completion routes

- [ ] **Step 7: Run backend typecheck**

Run: `pnpm --filter @clm/backend typecheck`
Expected: PASS

### Task 3: Build Backend Workspace Registration Endpoints

**Files:**
- Create: `apps/backend/src/modules/workspaces/repository.ts`
- Create: `apps/backend/src/modules/workspaces/service.ts`
- Create: `apps/backend/src/modules/workspaces/routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/modules/workspaces/service.test.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Write failing tests for workspace list and selection**

```ts
describe("workspaces", () => {
  it("lists known workspaces for the current user", async () => {
    expect(true).toBe(false);
  });

  it("creates or updates a workspace binding", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run backend tests to verify workspace scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing workspaces module behavior

- [ ] **Step 3: Add workspace repository and service**

```ts
export interface WorkspacesRepository {
  listForUser(userId: string): Promise<WorkspaceListItem[]>;
  selectWorkspace(userId: string, input: SelectWorkspaceRequest): Promise<SelectWorkspaceResponse>;
}
```

- [ ] **Step 4: Register workspace routes in `app.ts`**

```ts
await scopedApp.register(
  async (workspacesApp) => {
    await registerWorkspacesRoutes(workspacesApp, {
      workspacesService,
    });
  },
  {
    prefix: "/api/v1/workspaces",
  },
);
```

- [ ] **Step 5: Re-run backend tests for workspaces**

Run: `pnpm --filter @clm/backend test`
Expected: PASS for list/select workspace flows

- [ ] **Step 6: Run backend build**

Run: `pnpm --filter @clm/backend build`
Expected: PASS

### Task 4: Add Companion Frontend Pairing And Workspace Registration Flow

**Files:**
- Modify: `apps/companion/src/index.html`
- Modify: `apps/companion/src/main.ts`
- Modify: `apps/companion/src/styles.css`
- Modify: `apps/companion/src-tauri/src/commands.rs`
- Create: `apps/companion/src/api.ts`
- Test: `apps/companion`

- [ ] **Step 1: Write the failing companion integration expectations**

```ts
// Use existing companion typecheck/build workflow as the verification harness.
// The first failure should be unresolved imports / missing API wiring once new calls are introduced.
```

- [ ] **Step 2: Run companion typecheck before adding the pairing flow**

Run: `pnpm --filter @clm/companion typecheck`
Expected: PASS before changes

- [ ] **Step 3: Add a small companion API client**

```ts
export async function completePairing(payload: PairCompleteRequest) {
  const response = await fetch(`${BACKEND_URL}/api/v1/companion/pair/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error("Failed to complete pairing");
  return response.json();
}
```

- [ ] **Step 4: Add pairing UI and local machine-session state handling in the companion**

```ts
// Required states:
// - unpaired
// - entering pairing code
// - pairing failed
// - paired but no workspace selected
// - paired with workspace selected
```

- [ ] **Step 5: Wire folder selection to workspace registration**

```ts
const result = await invoke<FolderSelection | null>("select_folder");
if (result) {
  await selectWorkspace({
    machineId: deviceId,
    alias: result.alias,
    canonicalPathHash: result.pathHash,
    displayPathHint: result.path,
  });
}
```

- [ ] **Step 6: Run companion typecheck**

Run: `pnpm --filter @clm/companion typecheck`
Expected: PASS

- [ ] **Step 7: Run companion build**

Run: `pnpm --filter @clm/companion build`
Expected: PASS

### Task 5: Add Web Pairing And Workspace Surface

**Files:**
- Create: `apps/web/src/components/companion-pairing-panel.tsx`
- Create: `apps/web/src/components/workspaces-panel.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/components/dashboard-shell.tsx`
- Test: `apps/web`

- [ ] **Step 1: Add web API client methods for companion/workspace endpoints**

```ts
export function startPairing() {
  return request<PairStartResponse>("/api/v1/companion/pair/start", {
    method: "POST",
  });
}

export function getCompanionStatus() {
  return request<CompanionStatusResponse>("/api/v1/companion/status");
}

export function listWorkspaces() {
  return request<ListWorkspacesResponse>("/api/v1/workspaces");
}
```

- [ ] **Step 2: Add pairing and workspaces panels**

```tsx
<CompanionPairingPanel
  companion={dashboard.companion}
  onStartPairing={handleStartPairing}
  pairingCode={pairingCode}
  pairingExpiresAt={pairingExpiresAt}
/>
<WorkspacesPanel workspaces={workspaces} />
```

- [ ] **Step 3: Extend dashboard shell with pairing/workspace fetch and desktop-only display**

```tsx
// Keep mobile chat-first and suppress desktop companion flows on mobile-sized layouts where applicable.
```

- [ ] **Step 4: Run web typecheck**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

- [ ] **Step 5: Run web build**

Run: `pnpm --filter @clm/web build`
Expected: PASS

### Task 6: Reflect Real Companion/Workspace State In Dashboard Reads

**Files:**
- Modify: `apps/backend/src/modules/dashboard/repository.ts`
- Modify: `apps/backend/src/modules/dashboard/service.test.ts`
- Modify: `apps/backend/src/app.test.ts`
- Test: `apps/backend`

- [ ] **Step 1: Add failing backend tests for paired companion and registered workspace visibility**

```ts
it("surfaces connected companion state after pairing", async () => {
  expect(true).toBe(false);
});

it("surfaces the registered active workspace in the dashboard payload", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: Run backend tests to verify dashboard reflection scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing paired/workspace reflection behavior

- [ ] **Step 3: Tighten dashboard repository/service reads until paired state appears in the payload**

```ts
// Dashboard should now reflect real companion/workspace state after pairing and workspace selection.
```

- [ ] **Step 4: Re-run backend tests**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

- [ ] **Step 5: Run backend typecheck**

Run: `pnpm --filter @clm/backend typecheck`
Expected: PASS

### Task 7: Run Repository-Wide Verification For Milestone 3

**Files:**
- Test: repository verification commands

- [ ] **Step 1: Build shared-types**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

- [ ] **Step 2: Run backend tests/build**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

Run: `pnpm --filter @clm/backend build`
Expected: PASS

- [ ] **Step 3: Run companion typecheck/build**

Run: `pnpm --filter @clm/companion typecheck`
Expected: PASS

Run: `pnpm --filter @clm/companion build`
Expected: PASS

- [ ] **Step 4: Run web typecheck/build**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

Run: `pnpm --filter @clm/web build`
Expected: PASS

- [ ] **Step 5: Run workspace-wide verification**

Run: `pnpm typecheck`
Expected: PASS

Run: `pnpm test`
Expected: PASS for the packages that currently define tests
