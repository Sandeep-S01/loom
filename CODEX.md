# CODEX.md

Behavioral guidelines for coding agents in this workspace. Read this file before doing any task here.

These instructions work together with the system design in `/docs`. If there is a conflict, follow the explicit product and security constraints in the docs.

## 0. Read This First

Before doing any task in this workspace:

1. Read `CODEX.md`.
2. Read the relevant files in `/docs` for the task.
3. Follow the documented V1 boundaries before proposing or writing code.

## 1. Project Context

This project is a single-user AI workspace with:

- mobile chat-only access
- desktop chat and agent access
- backend-managed free-model routing and failover
- local desktop companion execution for agent mode
- strict local workspace boundaries for file and command actions

Do not introduce architecture that conflicts with these rules unless explicitly asked.

## 2. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State assumptions explicitly when they affect the design or code.
- If multiple interpretations exist, present them instead of picking silently.
- If a simpler approach exists, say so.
- If something is unclear and materially affects implementation, stop and ask.

## 3. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No extra configurability that is not required by V1 docs.
- No defensive handling for impossible scenarios.
- If the solution can be smaller and clearer, prefer that version.

Ask: would a senior engineer call this overbuilt? If yes, simplify it.

## 4. Surgical Changes

Touch only what you must.

When editing:

- Do not refactor unrelated areas.
- Match existing patterns unless the task requires a change.
- Do not clean up unrelated code.
- Remove only the dead code or imports created by your own change.

Every changed line should trace directly to the task.

## 5. Goal-Driven Execution

Define success criteria before implementation.

For multi-step work, use a short plan:

1. Step -> verify with a concrete check
2. Step -> verify with a concrete check
3. Step -> verify with a concrete check

Prefer verifiable outcomes:

- bug fix -> reproduce, fix, verify
- feature -> acceptance behavior, implement, verify
- refactor -> preserve behavior, run tests before and after

## 6. Project-Specific Guardrails

### Model Routing

- Provider API keys must stay on the backend.
- Do not add browser-direct provider calls.
- Chat and agent requests must route through the backend model router.
- Failover logic must preserve conversation or run continuity.
- When all free providers are unavailable, stop cleanly and show a product-level capacity message.

### Agent Mode

- Agent mode is desktop-only.
- Agent mode requires a connected local desktop companion.
- Agent mode requires a selected local project folder before execution.
- Local file and command actions must stay inside the selected workspace root.
- Do not implement agent behavior that assumes hosted sandboxes for V1.

### Mobile Experience

- Mobile is chat-only for V1.
- Do not expose agent controls or local workspace actions on mobile layouts.

### Security

- Follow `docs/SECURITY.md` for path boundaries, auditability, and secret handling.
- Do not expose provider keys, raw local paths, or unrestricted command capabilities to the browser.

## 7. Source of Truth

Use these documents when working in this repo:

- `docs/PRD.md` for feature requirements
- `docs/TDD.md` for architecture and technical decisions
- `docs/AGENTS.md` for agent capabilities and skill requirements
- `docs/API.md` for contracts
- `docs/DATABASE.md` for persistence design
- `docs/SECURITY.md` for security constraints
- `docs/UI_UX.md` for product behavior by device class
- `docs/MVP.md` for scope control
- `docs/ROADMAP.md` for delivery order

## 8. Required Skills For This Project

Only treat these as required for V1 work in this repository.

### Product and Design

- Product management
- SaaS architecture
- UX design for responsive web apps
- System design

### Backend and Realtime

- TypeScript backend development
- REST API design
- WebSocket or SSE streaming
- PostgreSQL
- Redis

### Frontend

- React
- Next.js
- TypeScript
- Tailwind CSS

### AI and Agent Systems

- LLM API integration
- OpenRouter-style provider aggregation
- MCP-style local tool patterns
- prompt engineering
- context compression
- tool or function calling

### Desktop and Platform

- local desktop companion architecture
- Docker
- GitHub Actions
- Nginx or equivalent reverse proxy
- application monitoring
- cloud infrastructure basics

### Security

- secure session auth
- secret management
- local workspace sandboxing and boundary checks

Not required for V1 unless scope changes:

- Go
- gRPC
- Kubernetes
- RAG
- embeddings
- OAuth
- JWT
- RBAC

## 9. Verification Before Completion

Before claiming work is done:

- run the relevant tests or checks
- verify the feature against the docs and task request
- mention anything you could not verify

These guidelines are working if diffs stay focused, V1 scope stays controlled, and implementation matches the documented product boundaries.
