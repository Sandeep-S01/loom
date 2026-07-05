# Milestone 2 Dashboard Design

## Objective

Implement a read-only dashboard landing page that gives the single V1 user one place to understand recent chat activity, recent agent activity, companion connection state, active workspace state, and provider availability summary.

## Scope

Included in this design:

- Backend `GET /api/v1/dashboard`
- Session-scoped dashboard aggregation
- Recent conversations panel
- Recent agent runs panel
- Companion status card
- Active workspace card
- Provider summary card
- Dashboard-first landing page
- Chat moved to a dedicated `/chat` route

Explicitly excluded from this design:

- Dashboard mutation actions
- Companion pairing
- Workspace selection mutation
- Agent execution controls
- Realtime dashboard updates
- Polling for companion/provider refresh

## Design Constraints

This design follows the current repo and product docs:

- `docs/PRD.md`: dashboard must surface recent conversations, recent runs, current workspace status, and provider health summary
- `docs/API.md`: dashboard contract should be served from `GET /api/v1/dashboard`
- `docs/DATABASE.md`: dashboard data comes from durable entities plus Redis-backed ephemeral state
- `docs/TDD.md`: backend should compute normalized application read models rather than exposing raw provider formats
- `docs/UI_UX.md`: dashboard is the desktop control-center view and mobile remains chat-first
- `docs/SECURITY.md`: user ownership remains explicit even in single-user mode

## Recommended Approach

The selected approach is a backend-computed dashboard read model.

Why this approach:

- It keeps the web app simple and read-only.
- It avoids multiple round-trips and frontend data stitching.
- It preserves the backend as the owner of provider/capacity interpretation.
- It is easy to extend later with dashboard actions without breaking the response shape.

Alternatives considered and rejected:

1. Build the dashboard by calling multiple frontend endpoints
   - Simpler at first glance, but it spreads dashboard logic into the client and makes consistency worse

2. Reuse existing conversation endpoints only and omit provider/companion/workspace state
   - Too incomplete for the documented milestone

## Architecture

Milestone 2 adds a dashboard module on the backend and a dashboard page on the web.

Backend:

- Add a `dashboard` module with one route: `GET /api/v1/dashboard`
- Aggregate data from existing stores:
  - recent conversations from PostgreSQL
  - recent agent runs from PostgreSQL
  - active workspace from PostgreSQL
  - companion connection from Redis
  - provider eligibility/cooldown summary from PostgreSQL plus Redis key state

Frontend:

- Make `/` the dashboard landing page
- Move the existing chat shell to `/chat`
- Render read-only summary cards and panels only
- Keep navigation lightweight and avoid premature desktop action controls

This keeps the dashboard useful before pairing and agent execution are fully implemented.

## API Design

Primary endpoint:

### `GET /api/v1/dashboard`

Purpose:

- Return one dashboard payload for the current session user

Response:

```json
{
  "recentConversations": [],
  "recentAgentRuns": [],
  "activeWorkspace": null,
  "companion": {
    "connected": false,
    "machineLabel": null
  },
  "providerSummary": {
    "eligibleCount": 0,
    "cooldownCount": 0,
    "lastExhaustedAt": null
  }
}
```

### Response field rules

`recentConversations`

- newest first
- limited to a small dashboard count such as 5
- exclude archived conversations

`recentAgentRuns`

- newest first
- limited to a small dashboard count such as 5
- return persisted status and timestamps only; no run-detail expansion

`activeWorkspace`

- return the most recently used active workspace for the session user
- return `null` when none exists

`companion`

- return `connected: false` and `machineLabel: null` if no Redis connection record exists
- if a connection record exists, surface machine label when available

`providerSummary`

- `eligibleCount`: count of active models currently eligible for use
- `cooldownCount`: count of models currently treated as cooling down
- `lastExhaustedAt`: keep `null` until exhaustion telemetry is actually persisted

## Data Model Usage

This slice uses:

- `conversations`
- `agent_runs`
- `workspaces`
- `providers`
- `models`

Redis usage:

- `companion:connection:{deviceId}`
- `provider:cooldown:{modelId}`

Tables intentionally not expanded in this milestone:

- `messages`
- `provider_attempts`
- `audit_events`
- `devices` beyond joining machine/companion context when available

## Backend Read Model Rules

### Recent conversations

- filter by current user
- exclude archived items
- order by `updated_at desc`
- return title, mode, updated time, and last message time

### Recent agent runs

- scope by the current user through workspace/conversation ownership
- if no runs exist yet, return an empty array
- do not synthesize placeholder run records

### Active workspace

- prefer the most recently used workspace with status `active`
- if all known workspaces are non-active, either return the most recent non-active workspace with its persisted status or return `null`
- the preferred first implementation is to return the most recent persisted workspace record when one exists

### Companion status

- if no Redis state exists, return disconnected
- if Redis state exists, map it into a stable `{ connected, machineLabel }` shape
- this milestone should not fail the whole dashboard request if Redis is temporarily unavailable; it should degrade to disconnected state

### Provider summary

- compute base candidate models from active provider/model records
- reduce eligibility by excluding models with cooldown state
- keep logic simple and deterministic
- do not try to infer advanced health trends in this milestone

## Web UX Design

Desktop dashboard layout:

- top heading area
- card row or grid for:
  - companion status
  - active workspace
  - provider summary
- two larger panels below:
  - recent conversations
  - recent agent runs

Mobile behavior:

- keep mobile chat-first
- dashboard can still render, but it should remain compact and non-agent-heavy
- do not expose desktop-only agent controls

Navigation:

- `/` becomes dashboard
- `/chat` becomes the existing chat UI route
- dashboard should include a simple way to move to chat, such as a link or header nav

Required states:

- empty dashboard
- partial dashboard with no runs/workspace
- disconnected companion state
- zero eligible models state
- backend error state

## Request Flow

### Dashboard load

1. Web app requests `GET /api/v1/session` if needed for session bootstrap
2. Web app requests `GET /api/v1/dashboard`
3. Backend aggregates the dashboard read model
4. Frontend renders the cards and panels

### Companion state fallback

1. Dashboard service checks Redis connection state
2. If state exists, map it into the response
3. If state is missing or Redis access fails, return disconnected

### Provider summary computation

1. Load active provider/model catalog from PostgreSQL
2. Check cooldown state for candidate models
3. Count eligible models and cooldown models
4. Return summary in normalized shape

## Error Handling

Required behavior:

- Invalid or missing session should continue to self-heal through the existing single-user bootstrap
- Dashboard route should return a structured backend error envelope on unexpected failure
- Redis read failure should not break the whole dashboard response; it should degrade companion and cooldown-derived fields conservatively

Important behavior:

- The dashboard is read-only, so degraded operational state should still return useful partial information whenever possible

## Security Considerations

This design must preserve:

- session-authenticated dashboard access
- user-scoped ownership for conversations, runs, and workspaces
- no provider secrets in the response
- no raw local paths in the response beyond already-approved display hints
- graceful handling of Redis state without leaking infrastructure internals

## Testing Strategy

Priority is backend correctness for aggregation and frontend build integrity.

### Backend unit and route tests

- dashboard returns empty-state payload for a user with no data
- recent conversations are ordered newest first
- recent agent runs are included when present
- companion state falls back to disconnected when no Redis record exists
- provider summary counts eligible and cooldown states correctly

### Frontend verification

- dashboard page build succeeds
- `/chat` page still builds and renders the existing chat shell
- typecheck confirms route split and component props

## File Boundaries

Preferred backend structure:

- `apps/backend/src/modules/dashboard/routes.ts`
- `apps/backend/src/modules/dashboard/service.ts`
- `apps/backend/src/modules/dashboard/repository.ts`

Preferred frontend structure:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/chat/page.tsx`
- `apps/web/src/components/dashboard-shell.tsx`
- `apps/web/src/components/dashboard-card.tsx`
- `apps/web/src/components/recent-conversations-panel.tsx`
- `apps/web/src/components/recent-agent-runs-panel.tsx`
- `apps/web/src/components/provider-summary-card.tsx`
- `apps/web/src/components/companion-status-card.tsx`
- `apps/web/src/components/active-workspace-card.tsx`

The existing chat shell and chat components should remain in place and be reused from the new `/chat` route.

## Acceptance Criteria

Milestone 2 is complete when all of the following are true:

- Opening `/` shows a dashboard instead of the chat page
- `GET /api/v1/dashboard` returns the documented normalized payload
- Recent conversations are shown from persisted data
- Recent agent runs are shown when available and empty cleanly when not
- Companion status shows disconnected when no live companion state exists
- Active workspace shows meaningful state when persisted, otherwise a clear empty state
- Provider summary shows eligible and cooldown counts without exposing secrets
- `/chat` still serves the working Milestone 1 chat UI

## Implementation Notes

- Keep the dashboard read-only in this slice
- Do not add polling, websockets, or SSE here
- Prefer small reusable dashboard cards over one large page component
- Use conservative fallbacks instead of inventing fake system state
