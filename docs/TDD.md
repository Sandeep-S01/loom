# Technical Design Document

## 1. Technical Summary

V1 uses a three-surface architecture:

- `Responsive Web App` for chat, dashboard, and desktop agent UI.
- `Backend Control Plane` for persistence, provider orchestration, failover, and audit logging.
- `Local Desktop Companion` for project-folder selection and local agent execution on the same machine.

## 2. Recommended Stack

### Frontend

- Next.js or React SPA with responsive layouts.
- TypeScript.
- WebSocket or Server-Sent Events for streaming messages and run events.
- Local state via a predictable client store.

### Backend

- Node.js with TypeScript using NestJS, Fastify, or Express with modular services.
- PostgreSQL for primary persistence.
- Redis for ephemeral routing state, cooldowns, websocket coordination, and short-lived run state.
- Background jobs via BullMQ or equivalent for queued orchestration tasks where needed.

### Desktop Companion

- Tauri recommended for a smaller footprint and better OS integration.
- TypeScript frontend shell with Rust or Node-backed native commands.
- Secure local service module for file and command operations.

## 3. System Components

### 3.1 Web App

Responsibilities:

- Authentication/session handling.
- Dashboard rendering.
- Conversation list and chat thread UI.
- Agent run UI and progress visualization.
- Companion pairing UX and workspace selection UX.

Key modules:

- `auth-client`
- `chat-ui`
- `agent-ui`
- `dashboard-ui`
- `realtime-client`
- `settings-ui`

### 3.2 API Gateway

Responsibilities:

- Session-authenticated API surface.
- Request validation.
- Routing to domain services.
- Realtime event fanout.

### 3.3 Chat Session Service

Responsibilities:

- Create/update/archive conversations.
- Persist messages.
- Manage conversation titles and metadata.

### 3.4 Model Router

Responsibilities:

- Normalize model invocation.
- Rank eligible models.
- Detect failure classes.
- Trigger failover.
- Create provider-attempt records.

### 3.5 Context Continuity Service

Responsibilities:

- Build compact handoff summaries for provider/model switching.
- Merge raw thread history and summary state.
- Ensure the next model gets enough prior context without replaying excessive history.

### 3.6 Agent Control Service

Responsibilities:

- Create agent runs.
- Maintain execution state machine.
- Translate user task intent into structured run context.
- Request actions through the companion gateway.
- Handle interruptions and failover.

### 3.7 Companion Gateway

Responsibilities:

- Pair desktop companion to backend.
- Maintain authenticated realtime channel.
- Route tool/action requests to the correct local machine.
- Validate workspace scope metadata.

### 3.8 Audit and Observability Service

Responsibilities:

- Structured logs.
- Metrics.
- Security audit events.
- Provider health and cooldown telemetry.

## 4. Core Flows

### 4.1 Chat Request Flow

1. Client submits message.
2. API validates session and payload.
3. Conversation is created or loaded.
4. Router selects preferred eligible model.
5. Provider request begins streaming.
6. On success, assistant message is persisted.
7. On failure, router classifies the error.
8. Continuity service generates or refreshes context snapshot.
9. Router selects next model.
10. Streaming resumes in the same conversation.
11. If no model is available, the conversation is marked blocked by capacity.

### 4.2 Agent Run Flow

1. Desktop client confirms companion connection.
2. User selects project root via companion.
3. API registers or reuses workspace binding.
4. User submits task.
5. Agent run record is created.
6. Router selects preferred agent-capable model.
7. Agent control service begins a run state machine.
8. Backend sends structured actions to companion.
9. Companion performs file/command actions and streams results.
10. Backend persists progress and may ask the model for next step.
11. On provider failure, run state and summary are preserved and failover occurs.
12. Run completes, stops, or ends blocked by provider exhaustion.

## 5. Agent Run State Machine

States:

- `pending`
- `planning`
- `executing`
- `waiting_for_companion`
- `switching_model`
- `completed`
- `stopped_by_user`
- `blocked_capacity`
- `failed_internal`

Transitions:

- `pending -> planning`
- `planning -> executing`
- `executing -> switching_model`
- `switching_model -> executing`
- `executing -> completed`
- `executing -> stopped_by_user`
- `executing -> blocked_capacity`
- `planning/executing -> waiting_for_companion` if companion disconnects

## 6. Provider Routing Policy

### Selection Inputs

- Model capability flags.
- Current cooldown state.
- Recent failure count.
- Agent suitability.
- Context window.
- Historical latency and completion reliability.

### Failure Classes

- `rate_limited_transient`
- `quota_exhausted`
- `provider_unreachable`
- `provider_5xx`
- `invalid_response`
- `auth_invalid`
- `policy_blocked`

### Routing Rules

- Retry same model once on transient timeout or intermittent 5xx if no recent similar failure exists.
- Switch immediately on `quota_exhausted` or `auth_invalid`.
- Cool down a provider/model after repeated hard failures.
- Restrict agent mode to models flagged `agent_safe`.

## 7. Realtime Strategy

- Web app maintains one authenticated realtime connection.
- Desktop companion maintains a separate authenticated machine channel.
- Backend emits conversation tokens, run events, provider-switch notifications, and companion status events.
- Frontend event store merges persisted and streaming state.

## 8. Storage Strategy

- PostgreSQL stores durable entities.
- Redis stores ephemeral lock/state data, cooldown counters, and live connection mappings.
- No provider keys in browser local storage.
- Desktop companion stores only minimal pairing metadata and local preferences.

## 9. Deployment Model

### Backend

- Containerized service deployment.
- Separate secrets store.
- Managed PostgreSQL.
- Managed Redis.

### Web App

- Static or server-rendered frontend deployment behind HTTPS.

### Desktop Companion

- Signed desktop build for target OS.
- Auto-update channel recommended after initial stabilization.

## 10. Scaling Path

V1 is single-user, but the design should not block later expansion:

- Keep user ownership on all persistent records.
- Keep machine/workspace bindings explicit.
- Keep routing and audit services multi-tenant ready in structure even if not enforced yet.

## 11. Technical Decisions

- Use a backend router instead of direct browser-provider calls to preserve secret ownership and continuity logic.
- Use a local companion instead of hosted sandboxes to satisfy the same-machine folder requirement.
- Use PostgreSQL plus Redis because the product needs durable history plus ephemeral failover/runtime state.

## 12. Required Skills and Stack Boundaries

This section defines the implementation skills and technology areas required for V1. It also documents technologies that are explicitly not required so the implementation does not drift into unnecessary complexity.

### Required for V1

#### Product and Design

- Product management
- SaaS architecture
- UX design for responsive web apps
- System design

#### Backend and Realtime

- TypeScript backend development
- REST API design
- WebSocket or Server-Sent Events
- PostgreSQL
- Redis

#### Frontend

- React
- Next.js
- TypeScript
- Tailwind CSS

#### AI and Agent Systems

- LLM API integration
- OpenRouter-style provider aggregation
- MCP-style local tool patterns
- prompt engineering
- context compression
- tool calling or function calling

#### Desktop and Platform

- local desktop companion architecture
- Docker
- GitHub Actions
- Nginx or equivalent reverse proxy
- application monitoring
- cloud infrastructure basics

#### Security

- secure session authentication
- secret management
- local workspace sandboxing and path-boundary enforcement

### Explicitly Not Required for V1

These may become relevant later, but they should not shape the initial architecture or implementation plan:

- Go
- gRPC
- Kubernetes
- RAG
- embeddings
- OAuth
- JWT
- RBAC

### Why These Boundaries Matter

- V1 is single-user, so full enterprise auth and role systems are unnecessary.
- Agent execution is local-machine based, so hosted distributed-agent complexity is unnecessary.
- The core risk is provider instability and local workspace safety, so effort should focus on routing, continuity, observability, and boundary enforcement.
