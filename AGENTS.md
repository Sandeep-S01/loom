# AGENTS.md

Workspace instructions for Codex when working in this repository. Read this file before doing any task here.

These instructions align Codex with the product design already documented under `/docs`.

## 0. Read This First

Before taking action in this workspace:

1. Read `AGENTS.md`.
2. Read the relevant documents in `/docs`.
3. Follow the documented V1 constraints before proposing or writing code.

## 1. Project Context

This project is a single-user AI workspace with:

- chat mode on mobile and desktop
- agent mode on desktop only
- backend-managed free-model orchestration
- automatic failover between eligible free models
- local desktop companion execution for agent mode
- strict workspace-root limits for file and command operations

Do not design or implement against a different product model unless explicitly instructed.

## 2. Working Style

Think before coding.

- State important assumptions explicitly.
- If the request is ambiguous in a way that changes implementation, ask.
- If there are multiple valid approaches, present the tradeoff briefly.
- Prefer the simplest implementation that satisfies the requirement.

## 3. Keep Changes Tight

Make surgical changes only.

- Do not refactor unrelated code.
- Do not add speculative abstractions.
- Match the existing project style and structure.
- Remove only unused code caused by your own changes.

Every edit should map directly to the current task.

## 4. Define Success Clearly

Translate requests into concrete outcomes you can verify.

Examples:

- fix a bug -> reproduce it, fix it, verify the fix
- add a feature -> implement the acceptance behavior, test it
- refactor -> preserve behavior, confirm before and after checks

For multi-step work, use a brief plan with a verification check per step.

## 5. Project Guardrails

### Backend and Providers

- All model/provider access belongs behind the backend.
- Never expose provider credentials to the browser or local companion.
- Provider switching and failover logic must remain backend-controlled.

### Chat

- Chat is available on mobile and desktop.
- Conversation continuity matters more than model branding.
- If failover happens, preserve session continuity.

### Agent

- Agent mode is desktop-only for V1.
- Agent mode requires the local desktop companion.
- Agent mode requires project-folder selection first.
- File and command operations must remain inside the selected workspace root.
- Do not assume hosted execution or remote repositories in V1.

### Mobile

- Mobile must remain chat-only.
- Do not surface local-agent flows in mobile UI.

### Security

- Respect `docs/SECURITY.md`.
- Enforce path boundary checks.
- Keep auditability for file edits, deletes, and commands.

## 6. Primary References

Use these as the source of truth:

- `docs/BRD.md`
- `docs/PRD.md`
- `docs/TDD.md`
- `docs/AGENTS.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/UI_UX.md`
- `docs/MVP.md`
- `docs/ROADMAP.md`

## 7. Required Skills For This Project

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

## 8. Completion Standard

Before saying the task is complete:

- run the relevant tests or validation steps
- verify the result matches the docs and request
- call out anything not verified or intentionally deferred

These instructions are successful if Codex produces focused diffs, avoids scope creep, and stays within the documented V1 architecture.
