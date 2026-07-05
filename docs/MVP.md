# MVP Definition

## 1. MVP Goal

Ship a working V1 that proves three things:

1. Free-model chat can continue across provider failures with minimal user disruption.
2. Desktop users can run a local code agent safely on a selected project folder.
3. One dashboard can unify both experiences across mobile and desktop.

## 2. Must-Have Features

### Chat

- Responsive chat UI.
- Conversation history.
- Backend-managed provider routing.
- Automatic failover across at least two free models.
- Clear exhaustion message when all configured free models are unavailable.

### Agent

- Desktop-only agent UI.
- Local desktop companion pairing.
- Local project folder selection.
- File read/create/update/delete within selected root.
- Command execution inside selected root.
- Run timeline and logs.
- Changed-files visibility.

### Dashboard

- Recent conversations.
- Recent agent runs.
- Companion connection status.
- Active workspace status.
- Provider health summary.

### Platform

- Single-user authentication/session.
- Audit logging.
- PostgreSQL persistence.
- Redis-backed ephemeral routing/runtime state.

## 3. Nice-to-Have But Not Required for MVP

- Conversation search.
- Agent run resume after backend restart.
- Git-aware diff visualization.
- Desktop companion auto-update.
- Provider performance charts.

## 4. Explicit Non-MVP

- Multi-user accounts and teams.
- Paid model fallback.
- Hosted execution sandboxes.
- Remote repository support.
- Fine-grained permission prompts for each agent action.
- Mobile agent mode.

## 5. MVP Success Criteria

- User can chat from mobile.
- User can chat from desktop.
- User can start an agent run on desktop after selecting a project folder.
- At least one forced provider failure can be recovered through failover without losing the conversation.
- If all configured models fail, the UI shows a clear message and retains the thread/run history.

## 6. Recommended Release Strategy

### Phase 1

- Build core backend, web chat, provider router, and persistence.

### Phase 2

- Add desktop companion pairing and workspace selection.

### Phase 3

- Add full agent execution loop, logs, and changed-files UI.

### Phase 4

- Harden audit, cooldown, capacity messaging, and recovery handling.
