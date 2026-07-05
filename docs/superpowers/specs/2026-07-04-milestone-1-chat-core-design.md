# Milestone 1 Chat Core Design

## Objective

Implement the first working chat slice for V1 as a single-user system with backend-owned session handling, conversation persistence, message persistence, backend model routing, and provider failover. This slice must align with the existing product docs while avoiding premature agent, dashboard, and multi-user complexity.

## Scope

Included in this design:

- Backend-managed single-user session bootstrap using the seeded user
- Conversation list and create flows
- Conversation message retrieval
- Send-message flow for chat conversations
- Backend provider/model routing for chat-capable models
- Provider attempt persistence
- Capacity-exhausted response handling that preserves thread history
- Web chat UI shell with conversation sidebar, thread view, and composer

Explicitly excluded from this design:

- Visible login screen
- Desktop companion pairing
- Dashboard implementation
- Agent execution
- Full token-by-token SSE/WebSocket streaming
- Conversation rename/archive flows
- Context snapshot generation for failover continuity

## Design Constraints

This design follows the current repo and docs:

- `docs/PRD.md`: single-user V1, backend-managed routing, persisted conversations, failover continuity
- `docs/API.md`: session-authenticated `/api/v1` contracts and normalized error envelope
- `docs/DATABASE.md`: user-scoped durable records and `provider_attempts`
- `docs/TDD.md`: backend control plane owns routing and persistence
- `docs/SECURITY.md`: secure cookie session, backend-owned secrets, no browser provider access
- `docs/UI_UX.md`: desktop chat layout with sidebar, thread panel, top utility state, and composer

## Recommended Approach

The selected approach is automatic backend session bootstrap for the seeded single user.

Why this approach:

- It preserves the documented session model without delaying chat delivery behind auth UI work.
- It keeps identity ownership on the backend rather than leaking a fake user contract into the frontend.
- It is easy to replace later with a real login flow because the web client still depends on a session endpoint instead of hardcoded user IDs.

Alternatives considered and rejected:

1. Minimal login screen for the seeded user
   - Closer to final auth shape, but unnecessary scope before chat value exists

2. Hardcoded user on every request with no session layer
   - Faster initially, but it creates a poor API foundation and conflicts with the docs' session-authenticated backend model

## Architecture

Milestone 1 adds a small chat stack across backend and web:

- A backend session plugin resolves the current V1 user from a secure cookie and creates a session automatically when missing.
- Conversation APIs provide list, create, and message retrieval for the current session user.
- A chat orchestration endpoint persists the user message, invokes a backend router, records provider attempts, persists the assistant reply, and returns normalized chat output.
- The web app becomes a desktop/mobile chat surface that loads session state, lists conversations, renders message history, and sends prompts through the backend.

No provider request will originate in the browser. Provider credentials remain backend-only.

## API Design

This slice intentionally narrows the broader `docs/API.md` surface to the minimum needed for a working chat core.

### `GET /api/v1/session`

Purpose:

- Return the current session user
- Create the single-user session if the cookie is missing but the seeded user exists

Response:

```json
{
  "user": {
    "id": "usr_001",
    "displayName": "Primary User",
    "email": "user@clm.local"
  }
}
```

### `GET /api/v1/conversations`

Purpose:

- Return non-archived conversations for the session user ordered by `updated_at desc`

Response:

```json
{
  "conversations": [
    {
      "id": "con_001",
      "mode": "chat",
      "title": "New Conversation",
      "lastMessageAt": null,
      "updatedAt": "2026-07-04T09:00:00.000Z"
    }
  ]
}
```

### `POST /api/v1/conversations`

Purpose:

- Create a new chat conversation for the session user

Request:

```json
{
  "mode": "chat",
  "title": "New Conversation"
}
```

Response:

```json
{
  "conversation": {
    "id": "con_001",
    "mode": "chat",
    "title": "New Conversation",
    "lastMessageAt": null,
    "updatedAt": "2026-07-04T09:00:00.000Z"
  }
}
```

### `GET /api/v1/conversations/:conversationId/messages`

Purpose:

- Return ordered messages for one conversation owned by the session user

Response:

```json
{
  "conversation": {
    "id": "con_001",
    "mode": "chat",
    "title": "Build a parser"
  },
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Help me debug this"
        }
      ],
      "createdAt": "2026-07-04T09:01:00.000Z"
    }
  ]
}
```

### `POST /api/v1/conversations/:conversationId/messages`

Purpose:

- Persist one user message
- Route to the best eligible chat model
- Fail over across eligible models when needed
- Persist the assistant reply
- Return a normalized response payload for the web app

Request:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Explain this error"
    }
  ]
}
```

Success response:

```json
{
  "userMessage": {
    "id": "msg_010",
    "role": "user"
  },
  "assistantMessage": {
    "id": "msg_011",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "Here is the likely cause..."
      }
    ]
  },
  "provider": {
    "providerId": "prv_openrouter",
    "modelId": "mdl_qwen3_30b_free",
    "modelName": "Qwen3 30B A3B (Free)"
  },
  "providerSwitched": {
    "switched": true,
    "fromModelId": "mdl_deepseek_chat_free",
    "toModelId": "mdl_qwen3_30b_free",
    "reason": "quota_exhausted"
  },
  "capacityBlocked": false
}
```

Capacity-exhausted response:

```json
{
  "userMessage": {
    "id": "msg_010",
    "role": "user"
  },
  "assistantMessage": null,
  "provider": null,
  "providerSwitched": null,
  "capacityBlocked": true,
  "error": {
    "code": "CAPACITY_EXHAUSTED",
    "message": "All currently configured free models are unavailable."
  }
}
```

### Conversation detail endpoint note

`docs/API.md` defines `GET /api/v1/conversations/:conversationId` for detail with messages. For this milestone, the repo may implement either:

- the documented detail endpoint, or
- `GET /api/v1/conversations/:conversationId/messages`

The preferred choice for this slice is the messages endpoint because it keeps the existing implementation narrower and clearer. If both are added cheaply, the detail endpoint should delegate to the same service.

## Data Model Usage

This slice uses existing schema structures already present in `apps/backend/src/db/schema.ts`.

Tables used directly:

- `users`
- `conversations`
- `messages`
- `providers`
- `models`
- `provider_attempts`
- `audit_events`

Tables intentionally not used in this milestone:

- `context_snapshots`
- `devices`
- `workspaces`
- `agent_runs`
- `agent_run_events`
- `file_operations`
- `command_executions`

### Persistence rules

- Every conversation remains user-scoped even though V1 has one user.
- Every send-message request persists the user message before model invocation.
- Assistant messages are persisted only on successful provider completion.
- Each provider/model attempt is persisted in `provider_attempts` with start/end timestamps, failure classification, and status.
- Capacity exhaustion does not delete or roll back the user message.
- Session bootstrap and any explicit session invalidation should be audit-friendly, but this milestone can defer full logout support.

## Provider Routing Design

The router for Milestone 1 should stay simple and deterministic.

### Eligible model selection

Filter models where:

- `active = true`
- `supportsChat = true`
- provider status is not `disabled`
- model is not currently in cooldown

Sort by:

1. provider priority
2. model priority

The initial implementation may ignore advanced historical latency scoring. The current docs allow a simpler V1-first ordering.

### Failure classification

Normalize provider errors into existing failure classes from `packages/shared-types/src/models.ts`:

- `rate_limited_transient`
- `quota_exhausted`
- `provider_unreachable`
- `provider_5xx`
- `invalid_response`
- `auth_invalid`
- `policy_blocked`

### Failover rules

- On `quota_exhausted`, `auth_invalid`, or `policy_blocked`: switch immediately
- On `provider_unreachable` or `provider_5xx`: switch after recording the failed attempt
- On `invalid_response`: switch after recording the failed attempt
- On success: persist assistant message and stop routing
- On exhaustion: return `capacityBlocked = true`

### Cooldown handling

Milestone 1 should support minimal cooldown integration using existing Redis key helpers:

- mark hard failures for cooldown tracking
- skip models already on cooldown

The exact TTL policy can remain simple in this milestone as long as the router structure supports it.

## Provider Client Adapters

The backend should isolate provider-specific HTTP logic behind small adapter files.

Initial providers:

- OpenRouter
- Google Gemini

Adapter responsibilities:

- build upstream request payloads from normalized message history
- execute the HTTP request using backend secrets
- normalize success output into one assistant text response
- normalize known error classes

The first milestone can restrict assistant output to text-only message content.

## Session Design

The web app should not know about the seeded user directly.

Backend behavior:

- Read the secure session cookie
- If a valid session exists, use it
- If no session exists, look up the seeded V1 user and create one automatically
- Set an `HttpOnly` cookie with strict same-site policy where compatible

This preserves the documented session boundary while avoiding UI login work.

## Web UX Design

This slice should convert the current phase-0 page into a usable chat UI.

Desktop layout:

- left sidebar for conversations
- main thread panel for messages
- top bar with conversation title and subtle provider state
- bottom composer for multiline prompt input

Mobile layout:

- chat-first single-column layout
- conversation list accessible without showing desktop agent controls

Required states:

- empty conversation state
- loading state
- sending state
- provider-switched note
- exhausted-capacity banner
- backend error state

Out of scope for Milestone 1:

- dashboard surface
- agent controls
- desktop companion status UI

## Request Flow

### App load

1. Web app requests `GET /api/v1/session`
2. Backend returns or bootstraps the single-user session
3. Web app requests `GET /api/v1/conversations`
4. UI renders conversation list and empty thread state

### Create conversation

1. User starts a new chat
2. Web app posts `POST /api/v1/conversations`
3. Backend creates the record for the session user
4. UI selects the new conversation

### Send message

1. Web app posts the user message content
2. Backend validates session ownership and conversation mode
3. Backend persists the user message with the next `sequence_no`
4. Backend loads prior conversation messages in order
5. Router selects the first eligible model
6. Adapter calls the upstream provider
7. On failure, backend records the failed attempt and switches models
8. On success, backend records success, persists the assistant message, updates conversation timestamps, and returns the assistant reply
9. On exhaustion, backend returns a capacity-blocked response and keeps the user message in history

## Error Handling

Required behavior:

- Unknown or foreign conversation access returns `404`
- Invalid request payload returns `400`
- Unsupported conversation mode for this endpoint returns `409`
- Total provider exhaustion returns a normalized capacity error, not a generic `500`
- Unexpected backend failure returns the standard error envelope with request ID

Important failure rule:

- Conversation state must remain intact even when assistant generation fails

## Security Considerations

This design must preserve the following controls:

- Provider secrets remain backend-only
- Browser never calls providers directly
- Session uses `HttpOnly` cookie semantics
- State-changing endpoints remain session-authenticated
- User ownership is validated on conversation and message access even in single-user mode
- Logs and responses avoid leaking raw provider secrets or internal credentials

Deferred but compatible:

- CSRF hardening beyond the minimal cookie/session setup
- rate limiting
- structured redaction rules

## Testing Strategy

Priority is backend correctness and persistence.

### Backend unit tests

- provider eligibility ordering
- failover behavior after first-model failure
- failure classification normalization
- message sequence number allocation

### Backend integration or route tests

- session bootstrap creates or restores the seeded user session
- conversation list returns only session-user conversations
- conversation create persists a chat conversation
- message send persists the user message and assistant reply on success
- message send records multiple provider attempts when failover occurs
- total exhaustion preserves the user message and returns capacity-blocked state

### Frontend tests

Keep minimal in this milestone:

- conversation list rendering
- message send happy path
- capacity banner rendering

## File Boundaries

Preferred backend structure:

- `apps/backend/src/plugins/session.ts`
- `apps/backend/src/plugins/request-context.ts`
- `apps/backend/src/modules/session/routes.ts`
- `apps/backend/src/modules/session/service.ts`
- `apps/backend/src/modules/conversations/routes.ts`
- `apps/backend/src/modules/conversations/repository.ts`
- `apps/backend/src/modules/chat/routes.ts`
- `apps/backend/src/modules/chat/service.ts`
- `apps/backend/src/modules/providers/router.ts`
- `apps/backend/src/modules/providers/types.ts`
- `apps/backend/src/modules/providers/openrouter-client.ts`
- `apps/backend/src/modules/providers/gemini-client.ts`
- `apps/backend/src/modules/providers/repository.ts`

Preferred frontend structure:

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/chat-shell.tsx`
- `apps/web/src/components/conversation-sidebar.tsx`
- `apps/web/src/components/message-thread.tsx`
- `apps/web/src/components/message-composer.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/types.ts`

The exact structure can vary slightly if existing app conventions demand it, but responsibilities should stay this separated.

## Acceptance Criteria

Milestone 1 is complete when all of the following are true:

- Opening the web app establishes or restores a backend-owned single-user session
- The user can create and resume chat conversations
- The user can send a message and receive an assistant reply persisted in the conversation
- The backend routes requests through configured chat-capable models only
- At least one provider failure can trigger failover to another eligible model in the same conversation flow
- If all eligible models fail, the conversation remains intact and the UI shows a clear capacity message
- No provider secrets are exposed to the browser

## Implementation Notes

- Keep this milestone text-first; do not introduce vision or tool-calling requirements
- Do not implement dashboard or agent features in this slice
- Reuse the existing shared types where they fit, but do not over-abstract the first implementation
- Match the current repo's modular TypeScript style instead of introducing a heavy framework layer
