# Milestone 1 Chat Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working single-user chat slice with backend-owned session bootstrap, persistent conversations and messages, backend provider routing with failover, and a usable web chat UI.

**Architecture:** Add thin backend modules for session, conversations, chat orchestration, and provider routing on top of the existing Fastify shell and database schema. Replace the current phase-0 web page with a minimal chat client that talks only to backend APIs and renders conversation history, send state, provider-switch notes, and capacity-blocked states.

**Tech Stack:** Fastify, TypeScript, Drizzle ORM, PostgreSQL, Redis key helpers, Next.js App Router, React 19, Tailwind CSS, Vitest

---

### Task 1: Add Shared API Contracts For Chat Core

**Files:**
- Modify: `packages/shared-types/src/api.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/api.ts`

- [ ] **Step 1: Define the Milestone 1 request and response contracts**

```ts
export interface SessionUserDto {
  id: string;
  displayName: string;
  email: string;
}

export interface SessionResponseDto {
  user: SessionUserDto;
}

export interface ConversationListItemDto {
  id: string;
  mode: "chat";
  title: string;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface ListConversationsResponseDto {
  conversations: ConversationListItemDto[];
}

export interface CreateConversationRequestDto {
  mode: "chat";
  title?: string;
}

export interface CreateConversationResponseDto {
  conversation: ConversationListItemDto;
}

export interface MessageDto {
  id: string;
  role: "user" | "assistant" | "system" | "status" | "tool";
  content: Array<{
    type: "text";
    text: string;
  }>;
  providerId?: string | null;
  modelId?: string | null;
  createdAt: string;
}

export interface ConversationMessagesResponseDto {
  conversation: {
    id: string;
    mode: "chat";
    title: string;
  };
  messages: MessageDto[];
}

export interface SendMessageRequestDto {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface SendMessageResponseDto {
  userMessage: {
    id: string;
    role: "user";
  };
  assistantMessage: MessageDto | null;
  provider: {
    providerId: string;
    modelId: string;
    modelName: string;
  } | null;
  providerSwitched: {
    switched: boolean;
    fromModelId: string;
    toModelId: string;
    reason: string;
  } | null;
  capacityBlocked: boolean;
  error?: {
    code: string;
    message: string;
  };
}
```

- [ ] **Step 2: Export the new API contracts from the shared-types package**

```ts
export * from "./api.js";
export * from "./events.js";
export * from "./models.js";
export * from "./tools.js";
```

- [ ] **Step 3: Run the shared-types build to verify the contracts compile**

Run: `pnpm --filter @clm/shared-types build`
Expected: successful TypeScript build with regenerated `dist` output

- [ ] **Step 4: Checkpoint the repo state**

Run: `git rev-parse --is-inside-work-tree`
Expected: failure in this workspace; use the successful shared-types build as the checkpoint because the workspace is not currently initialized as a git repository

### Task 2: Build Backend Session, Conversation, And Chat Modules

**Files:**
- Create: `apps/backend/src/plugins/session.ts`
- Create: `apps/backend/src/plugins/request-context.ts`
- Create: `apps/backend/src/lib/http-errors.ts`
- Create: `apps/backend/src/modules/session/routes.ts`
- Create: `apps/backend/src/modules/session/service.ts`
- Create: `apps/backend/src/modules/conversations/routes.ts`
- Create: `apps/backend/src/modules/conversations/repository.ts`
- Create: `apps/backend/src/modules/chat/routes.ts`
- Create: `apps/backend/src/modules/chat/service.ts`
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/index.ts`

- [ ] **Step 1: Write the failing backend route tests for session bootstrap and conversation CRUD**

```ts
import { describe, expect, it } from "vitest";

describe("session bootstrap", () => {
  it("returns the seeded single user", async () => {
    expect(true).toBe(false);
  });
});

describe("conversation routes", () => {
  it("creates and lists chat conversations for the session user", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the backend tests to verify the new scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing route/module or intentional assertion failures

- [ ] **Step 3: Add a session plugin that resolves or bootstraps the seeded user**

```ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export const sessionPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest("sessionUser", null);

  app.addHook("preHandler", async (request, reply) => {
    const existingUserId = request.cookies.clm_session_user_id;
    const user = await app.sessionService.resolveSessionUser(existingUserId);

    request.sessionUser = user;

    if (existingUserId !== user.id) {
      reply.setCookie("clm_session_user_id", user.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  });
});
```

- [ ] **Step 4: Add the session service and conversation repository**

```ts
export async function resolveSessionUser(sessionUserId?: string) {
  if (sessionUserId) {
    const existing = await findUserById(sessionUserId);
    if (existing) return existing;
  }

  const seeded = await findUserByEmail(process.env.DEFAULT_USER_EMAIL ?? "user@clm.local");
  if (!seeded) {
    throw new Error("Seeded single user not found");
  }

  return seeded;
}

export async function createConversation(userId: string, title: string) {
  const id = generateId("con");

  await db.insert(conversations).values({
    id,
    userId,
    mode: "chat",
    title,
  });

  return findConversationByIdForUser(id, userId);
}
```

- [ ] **Step 5: Register the routes in the Fastify app**

```ts
await app.register(sessionPlugin);
await app.register(sessionRoutes, { prefix: "/api/v1/session" });
await app.register(conversationRoutes, { prefix: "/api/v1/conversations" });
await app.register(chatRoutes, { prefix: "/api/v1/conversations" });
```

- [ ] **Step 6: Re-run backend tests for session and conversation routes**

Run: `pnpm --filter @clm/backend test`
Expected: session bootstrap and conversation route tests pass; chat send tests still fail because routing is not implemented yet

- [ ] **Step 7: Checkpoint the backend foundation**

Run: `pnpm --filter @clm/backend typecheck`
Expected: successful backend typecheck

### Task 3: Add Provider Clients, Router, And Send-Message Orchestration

**Files:**
- Create: `apps/backend/src/modules/providers/types.ts`
- Create: `apps/backend/src/modules/providers/repository.ts`
- Create: `apps/backend/src/modules/providers/router.ts`
- Create: `apps/backend/src/modules/providers/openrouter-client.ts`
- Create: `apps/backend/src/modules/providers/gemini-client.ts`
- Modify: `apps/backend/src/modules/chat/service.ts`
- Test: `apps/backend/src/modules/providers/router.test.ts`
- Test: `apps/backend/src/modules/chat/service.test.ts`

- [ ] **Step 1: Write the failing router and chat service tests**

```ts
import { describe, expect, it } from "vitest";

describe("provider router", () => {
  it("skips failed first choice and selects the next eligible chat model", async () => {
    expect(true).toBe(false);
  });
});

describe("chat service", () => {
  it("persists the user message and assistant message on success", async () => {
    expect(true).toBe(false);
  });

  it("preserves the user message when all providers are exhausted", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the backend tests to verify routing scenarios fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing provider router/client behavior

- [ ] **Step 3: Implement normalized provider client types and a deterministic router**

```ts
export interface ProviderInvocationSuccess {
  ok: true;
  text: string;
}

export interface ProviderInvocationFailure {
  ok: false;
  failureCode:
    | "rate_limited_transient"
    | "quota_exhausted"
    | "provider_unreachable"
    | "provider_5xx"
    | "invalid_response"
    | "auth_invalid"
    | "policy_blocked";
}

export type ProviderInvocationResult =
  | ProviderInvocationSuccess
  | ProviderInvocationFailure;

export async function getEligibleChatModels() {
  return db
    .select({
      providerId: providers.id,
      providerName: providers.name,
      providerPriority: providers.priorityRank,
      modelId: models.id,
      modelName: models.name,
      externalModelKey: models.externalModelKey,
      modelPriority: models.priorityRank,
      baseType: providers.baseType,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.active, true), eq(models.supportsChat, true), ne(providers.status, "disabled")));
}
```

- [ ] **Step 4: Implement chat orchestration with provider attempts and failover**

```ts
for (const candidate of eligibleModels) {
  const startedAt = new Date();
  const result = await invokeProvider(candidate, history);

  if (result.ok) {
    await recordProviderAttempt({
      status: "success",
      startedAt,
      endedAt: new Date(),
    });

    const assistantMessage = await insertAssistantMessage({
      conversationId,
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      text: result.text,
    });

    return {
      userMessage,
      assistantMessage,
      provider: {
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        modelName: candidate.modelName,
      },
      providerSwitched: previousCandidate
        ? {
            switched: true,
            fromModelId: previousCandidate.modelId,
            toModelId: candidate.modelId,
            reason: lastFailureCode,
          }
        : null,
      capacityBlocked: false,
    };
  }

  await recordProviderAttempt({
    status: "failed",
    failureCode: result.failureCode,
    startedAt,
    endedAt: new Date(),
  });

  previousCandidate = candidate;
  lastFailureCode = result.failureCode;
}

return {
  userMessage,
  assistantMessage: null,
  provider: null,
  providerSwitched: null,
  capacityBlocked: true,
  error: {
    code: "CAPACITY_EXHAUSTED",
    message: "All currently configured free models are unavailable.",
  },
};
```

- [ ] **Step 5: Re-run backend tests for router and chat flows**

Run: `pnpm --filter @clm/backend test`
Expected: router and chat tests pass, including failover and capacity-preservation scenarios

- [ ] **Step 6: Verify backend build output**

Run: `pnpm --filter @clm/backend build`
Expected: successful backend build

### Task 4: Replace The Web Phase-0 Shell With The Chat UI

**Files:**
- Create: `apps/web/src/components/chat-shell.tsx`
- Create: `apps/web/src/components/conversation-sidebar.tsx`
- Create: `apps/web/src/components/message-thread.tsx`
- Create: `apps/web/src/components/message-composer.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/app/page.tsx`
- Test: `apps/web` build and typecheck commands

- [ ] **Step 1: Verify the current web app still only exposes the phase-0 shell**

Run: `pnpm --filter @clm/web build`
Expected: PASS with the current phase-0 shell before replacement

- [ ] **Step 2: Run web typecheck before replacing the UI**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS before UI replacement

- [ ] **Step 3: Create a thin web API client and chat shell state**

```ts
export async function getSession() {
  const response = await fetch("http://localhost:3001/api/v1/session", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Failed to load session");
  return response.json();
}

export async function createConversation() {
  const response = await fetch("http://localhost:3001/api/v1/conversations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", title: "New Conversation" }),
  });

  if (!response.ok) throw new Error("Failed to create conversation");
  return response.json();
}
```

- [ ] **Step 4: Replace `page.tsx` with a real chat shell**

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen bg-app-bg text-text-primary">
      <ChatShell />
    </main>
  );
}
```

- [ ] **Step 5: Render required Milestone 1 states in the UI**

```tsx
{capacityBlocked ? (
  <div className="rounded-lg border border-state-danger/30 bg-state-danger/10 p-3 text-sm text-state-danger">
    All currently configured free models are unavailable.
  </div>
) : null}

{providerSwitchNote ? (
  <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 p-3 text-sm text-state-warning">
    Response continued after switching models.
  </div>
) : null}
```

- [ ] **Step 6: Verify the web app compiles after the UI replacement**

Run: `pnpm --filter @clm/web build`
Expected: successful Next.js production build

- [ ] **Step 7: Verify the replaced chat shell typechecks cleanly**

Run: `pnpm --filter @clm/web typecheck`
Expected: PASS

### Task 5: Add End-To-End Backend Verification And Tighten Error Behavior

**Files:**
- Modify: `apps/backend/src/modules/chat/service.ts`
- Modify: `apps/backend/src/modules/conversations/routes.ts`
- Modify: `apps/backend/src/modules/chat/routes.ts`
- Test: `apps/backend/src/modules/chat/service.test.ts`
- Test: `apps/backend/src/modules/conversations/routes.test.ts`

- [ ] **Step 1: Add the final failing tests for 404, 400, and mode-guard behavior**

```ts
describe("conversation ownership and validation", () => {
  it("returns 404 for an unknown conversation", async () => {
    expect(true).toBe(false);
  });

  it("returns 400 for invalid message content payloads", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the backend tests to verify the new error expectations fail**

Run: `pnpm --filter @clm/backend test`
Expected: FAIL with missing validation or route error mapping

- [ ] **Step 3: Implement route-level validation and normalized error responses**

```ts
if (!Array.isArray(body.content) || body.content.length === 0) {
  throw badRequest("Message content is required");
}

for (const item of body.content) {
  if (item.type !== "text" || typeof item.text !== "string" || item.text.trim() === "") {
    throw badRequest("Only non-empty text message content is supported");
  }
}

if (!conversation) {
  throw notFound("Conversation not found");
}

if (conversation.mode !== "chat") {
  throw conflict("Conversation is not a chat thread");
}
```

- [ ] **Step 4: Re-run backend tests to confirm validation and ownership rules pass**

Run: `pnpm --filter @clm/backend test`
Expected: all backend tests pass

- [ ] **Step 5: Verify the backend typecheck after the final tightening**

Run: `pnpm --filter @clm/backend typecheck`
Expected: PASS

### Task 6: Run Repository-Wide Verification For The Milestone 1 Slice

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/web/src/app/page.tsx`
- Test: `apps/backend`
- Test: `apps/web`
- Test: `packages/shared-types`
- Test: `packages/shared-utils`

- [ ] **Step 1: Build the shared packages**

Run: `pnpm --filter @clm/shared-types build`
Expected: PASS

Run: `pnpm --filter @clm/shared-utils build`
Expected: PASS

- [ ] **Step 2: Run the shared utility tests**

Run: `pnpm --filter @clm/shared-utils test`
Expected: PASS

- [ ] **Step 3: Run the backend test suite**

Run: `pnpm --filter @clm/backend test`
Expected: PASS

- [ ] **Step 4: Run the backend and web builds**

Run: `pnpm --filter @clm/backend build`
Expected: PASS

Run: `pnpm --filter @clm/web build`
Expected: PASS

- [ ] **Step 5: Run repo-wide typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Final checkpoint**

Run: `pnpm test`
Expected: PASS for the implemented milestone scope; if any package still fails because it lacks tests or configuration, fix that before claiming completion
