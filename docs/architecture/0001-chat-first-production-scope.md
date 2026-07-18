# ADR 0001: Chat-First Production Scope

## Status

Accepted for the first production release.

## Decision

The first production release includes authenticated chat, conversation history,
manual model selection, backend-owned provider routing, automatic failover,
model administration, marketplace administration, and routing diagnostics.

Agent execution is not part of the first production release. Agent database
tables and shared contracts remain available for future implementation, but the
product must not expose an action that implies local file or command execution
until the companion gateway, tool sandbox, audit trail, and stop/recovery flows
have passed their dedicated release gate.

## Runtime Boundaries

- `apps/web` is the browser UI and never receives provider credentials.
- `apps/backend` owns authentication, persistence, model routing, and provider calls.
- `apps/companion` may pair and register a workspace, but does not execute agent tools.
- PostgreSQL stores durable product state.
- Redis stores short-lived coordination state.

## Release Configuration

Required production configuration:

- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_URL` or `FRONTEND_URLS`
- at least one provider secret referenced by an active model

Development-only configuration:

- `ALLOW_DEV_SESSION`
- `DEFAULT_USER_EMAIL`
- `DEFAULT_USER_PASSWORD`

Provider and load-control tuning is optional and must retain documented defaults.

## Consequences

The chat product can be hardened and released without representing incomplete
local-agent scaffolding as customer-ready functionality. Enabling agent mode
later requires a separate architecture decision and security gate.
