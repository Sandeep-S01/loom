# Milestone 3 Companion Pairing And Workspaces Design

## Objective

Implement the full V1 pairing and workspace-registration flow across the web app, backend, and Tauri desktop companion so a desktop user can connect a local machine, select a project folder, and persist that workspace binding for later agent use.

## Scope

Included in this design:

- Backend pairing challenge creation and completion
- Backend companion status lookup
- Backend workspace list and workspace registration/update
- Web desktop pairing UX
- Web companion status and workspace display
- Tauri companion pairing UX
- Tauri companion token exchange and minimal local persistence
- Tauri folder selection followed by backend workspace registration
- Dashboard reflection of real companion/workspace state

Explicitly excluded from this design:

- Agent execution
- Realtime agent channels
- Approval prompts
- Rich device/session management
- Background reconnect automation beyond simple persisted machine session reuse
- Multi-device management UX

## Design Constraints

This design follows the existing docs:

- `docs/PRD.md`: agent mode requires a connected local desktop companion and a selected project folder
- `docs/API.md`: pairing and workspace endpoints already exist in the intended V1 surface
- `docs/DATABASE.md`: durable `devices` and `workspaces`, Redis for ephemeral connection state
- `docs/TDD.md`: backend owns pairing, persistence, and policy; companion is trusted only for local execution within approved scope
- `docs/SECURITY.md`: pairing tokens short-lived, machine sessions minimal, no provider keys in companion, path storage prefers hashes plus display hints
- `docs/UI_UX.md`: desktop-first companion/workspace flow, mobile remains chat-first

## Recommended Approach

The selected approach is a full but tightly scoped pairing flow:

- web app starts pairing and displays a short-lived code
- companion submits that code to complete pairing
- backend issues a machine session token
- companion reports live connection state
- companion selects a folder and registers a workspace binding

Why this approach:

- The web, backend, and companion contracts need to be designed together
- Pairing without the companion UX is incomplete
- Companion UX without backend registration leads to throwaway local state
- This milestone becomes directly useful to the dashboard and unlocks the next agent-execution milestone cleanly

Alternatives considered and rejected:

1. Backend-only pairing first
   - faster to implement in isolation, but likely to require contract rework once the companion UI is actually wired

2. Companion-local pairing only with no backend device/workspace persistence
   - contradicts the documented control-plane model and leaves the dashboard blind

## Architecture

Milestone 3 spans all three surfaces.

Backend:

- Add a `companion` module:
  - `POST /api/v1/companion/pair/start`
  - `POST /api/v1/companion/pair/complete`
  - `GET /api/v1/companion/status`
- Add a `workspaces` module:
  - `GET /api/v1/workspaces`
  - `POST /api/v1/workspaces/select`
- Persist devices and workspaces in PostgreSQL
- Persist short-lived pairing challenges and live companion connection state in Redis

Companion:

- Add pairing UI
- Accept a pairing code from the user
- Exchange it with backend for machine credentials
- Persist only minimal machine session metadata locally
- Report connected/disconnected state to backend
- Allow folder selection and workspace registration after pairing

Web:

- Add a desktop-only pairing/status/workspace surface
- Show current companion connection state
- Show known workspaces and active workspace
- Start pairing by generating a short-lived code

This milestone stops at “paired and workspace registered,” intentionally before agent execution.

## API Design

### `POST /api/v1/companion/pair/start`

Purpose:

- Create a short-lived pairing challenge for the current session user

Response:

```json
{
  "pairingCode": "pair_123456",
  "expiresAt": "2026-07-04T12:00:00.000Z"
}
```

### `POST /api/v1/companion/pair/complete`

Purpose:

- Validate a pairing code submitted by the Tauri companion
- Create or update a `devices` record
- Issue machine session credentials to the companion

Request:

```json
{
  "pairingCode": "pair_123456",
  "machineLabel": "My Laptop",
  "machineFingerprintHash": "sha256:def"
}
```

Response:

```json
{
  "deviceId": "dev_001",
  "machineSessionToken": "redacted"
}
```

### `GET /api/v1/companion/status`

Purpose:

- Return connection status for the current user’s paired companion

Response:

```json
{
  "connected": true,
  "machineLabel": "My Laptop",
  "deviceId": "dev_001"
}
```

### `GET /api/v1/workspaces`

Purpose:

- Return known workspaces for the current user

Response:

```json
{
  "workspaces": [
    {
      "id": "wrk_001",
      "alias": "clm_tool",
      "machineId": "dev_001",
      "status": "active",
      "displayPathHint": "D:\\Personal_Project\\clm_tool"
    }
  ]
}
```

### `POST /api/v1/workspaces/select`

Purpose:

- Register or update a selected workspace from the companion

Request:

```json
{
  "machineId": "dev_001",
  "alias": "clm_tool",
  "canonicalPathHash": "sha256:abc",
  "displayPathHint": "D:\\Personal_Project\\clm_tool"
}
```

Response:

```json
{
  "workspace": {
    "id": "wrk_001",
    "alias": "clm_tool",
    "machineId": "dev_001",
    "status": "active"
  }
}
```

## Data Model Usage

Persistent tables used:

- `devices`
- `workspaces`
- `audit_events`

Redis state used:

- pairing challenge records keyed by pairing code
- `companion:connection:{deviceId}` live connection state

Data handling rules:

- Browser never receives the machine session token
- Companion never receives provider keys
- Workspace persistence stores canonical path hash and display hint
- Device records remain user-scoped even in V1 single-user mode

## Core Flow

### Pairing start

1. Web user opens the pairing screen
2. Web app calls `POST /api/v1/companion/pair/start`
3. Backend creates a short-lived challenge in Redis
4. Web app displays the pairing code and expiry

### Pairing completion

1. User enters the pairing code into the Tauri companion
2. Companion sends pairing code, machine label, and fingerprint hash
3. Backend validates the challenge
4. Backend creates or updates a `devices` record
5. Backend returns `deviceId` and `machineSessionToken`
6. Companion stores minimal machine-session metadata locally

### Connection state reporting

1. Companion authenticates using the machine session token
2. Companion writes or refreshes connection state in Redis
3. Web app reads `GET /api/v1/companion/status`
4. Dashboard and pairing views reflect connected/disconnected state

### Workspace registration

1. User selects a folder in the companion
2. Companion canonicalizes the path and computes the path hash
3. Companion posts `POST /api/v1/workspaces/select`
4. Backend creates or updates a workspace binding
5. Web app and dashboard can read the workspace through `GET /api/v1/workspaces`

## Companion UX Design

Companion states:

- unpaired
- entering pairing code
- pairing failed
- paired but no workspace selected
- paired with workspace selected

Companion UI requirements:

- simple pairing-code input
- connected machine status
- folder-selection button
- selected workspace display
- basic error message for invalid or expired pairing code

The companion should stay intentionally operational rather than decorative.

## Web UX Design

Desktop-only pairing surface should show:

- current connection state
- action to start pairing
- current pairing code and expiry when active
- known workspaces list
- active workspace display

Dashboard should begin reflecting:

- connected/disconnected companion
- active workspace state

Mobile behavior:

- mobile remains chat-first
- do not expose desktop companion flows on mobile

## Error Handling

Required behavior:

- expired pairing code -> structured rejection
- invalid pairing code -> structured rejection
- reused pairing code -> structured rejection or one-time-use invalidation
- Redis unavailable during status reads -> disconnected fallback
- invalid workspace payload -> structured `400`
- duplicate workspace selection on same machine/path -> update or reuse existing binding rather than duplicate records

Important behavior:

- pairing failures must not leave partial browser-visible machine credentials
- backend restart after challenge creation should invalidate or naturally expire the challenge safely

## Security Considerations

This design must preserve:

- short-lived pairing challenges
- machine credentials visible only to the companion
- companion sessions bound to device identity metadata
- no provider secrets in the companion
- user-scoped device/workspace ownership
- path storage by hash plus display hint where possible
- auditability for pairing, connection, and workspace selection

## Testing Strategy

### Backend tests

- pairing challenge creation
- invalid and expired pairing code rejection
- successful pair completion
- companion status lookup with Redis-present and Redis-missing cases
- workspace registration create/update behavior

### Companion verification

- `typecheck`
- `build`
- pairing UI state transitions
- folder-selection and workspace registration logic

### Web verification

- `typecheck`
- `build`
- pairing/status surface rendering
- desktop-only gating where applicable

## File Boundaries

Preferred backend structure:

- `apps/backend/src/modules/companion/routes.ts`
- `apps/backend/src/modules/companion/service.ts`
- `apps/backend/src/modules/companion/repository.ts`
- `apps/backend/src/modules/workspaces/routes.ts`
- `apps/backend/src/modules/workspaces/service.ts`
- `apps/backend/src/modules/workspaces/repository.ts`

Preferred companion structure:

- `apps/companion/src/main.ts`
- `apps/companion/src/index.html`
- `apps/companion/src/styles.css`
- `apps/companion/src-tauri/src/commands.rs`
- optional small frontend API client/helper file in `apps/companion/src/`

Preferred web structure:

- desktop pairing/status surface components
- API client additions for companion/workspace endpoints

## Acceptance Criteria

Milestone 3 is complete when all of the following are true:

- Web app can start a pairing challenge and display a short-lived code
- Companion can complete pairing using that code
- Backend persists device identity and returns machine credentials only to the companion
- Web app can show connected/disconnected companion status
- Companion can select a folder and register a workspace
- Backend persists or updates workspace bindings correctly
- Dashboard begins reflecting real companion/workspace state

## Implementation Notes

- Keep this milestone focused on pairing and workspace registration only
- Do not begin agent execution work here
- Prefer minimal local companion persistence
- Keep the UX operational and explicit rather than overdesigned
