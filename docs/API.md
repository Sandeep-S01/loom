# API Design

## 1. API Principles

- JSON over HTTPS for request/response APIs.
- WebSocket or SSE for streaming chat and run events.
- Session-authenticated endpoints.
- Stable normalized contracts independent of upstream provider format.

## 2. Authentication

V1 is single-user. Recommended approach:

- Secure session cookie for web app.
- Companion pairing token plus machine session for desktop companion.

## 3. REST Endpoints

### 3.1 Session

#### `POST /api/v1/session/login`

Creates a user session.

Request:

```json
{
  "email": "user@example.com",
  "password": "redacted"
}
```

Response:

```json
{
  "user": {
    "id": "usr_001",
    "displayName": "Primary User"
  }
}
```

#### `POST /api/v1/session/logout`

Invalidates session.

### 3.2 Dashboard

#### `GET /api/v1/dashboard`

Returns recent conversations, recent runs, companion state, and provider summary.

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

### 3.3 Conversations

#### `GET /api/v1/conversations`

Lists conversations.

#### `POST /api/v1/conversations`

Creates a conversation.

Request:

```json
{
  "mode": "chat",
  "title": "New Conversation"
}
```

#### `GET /api/v1/conversations/:conversationId`

Returns conversation detail with messages.

#### `PATCH /api/v1/conversations/:conversationId`

Updates title or archived state.

#### `POST /api/v1/conversations/:conversationId/messages`

Adds a user message and starts an assistant response.

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

Response:

```json
{
  "streamId": "str_001",
  "messageId": "msg_001",
  "status": "streaming"
}
```

### 3.4 Companion Pairing

#### `POST /api/v1/companion/pair/start`

Creates a short-lived pairing challenge.

#### `POST /api/v1/companion/pair/complete`

Completes pairing and returns machine session credentials.

#### `GET /api/v1/companion/status`

Returns current companion connection state.

### 3.5 Workspaces

#### `GET /api/v1/workspaces`

Lists known workspace bindings.

#### `POST /api/v1/workspaces/select`

Registers a selected local folder from the companion.

Request:

```json
{
  "machineId": "mac_001",
  "alias": "clm_tool",
  "canonicalPathHash": "sha256:abc"
}
```

Response:

```json
{
  "workspace": {
    "id": "wrk_001",
    "alias": "clm_tool",
    "machineId": "mac_001",
    "status": "active"
  }
}
```

### 3.6 Agent Runs

#### `POST /api/v1/agent-runs`

Starts an agent run.

Request:

```json
{
  "workspaceId": "wrk_001",
  "objective": "Refactor the settings module"
}
```

Response:

```json
{
  "runId": "run_001",
  "status": "pending",
  "streamId": "str_002"
}
```

#### `GET /api/v1/agent-runs`

Lists recent agent runs.

#### `GET /api/v1/agent-runs/:runId`

Returns run detail.

#### `POST /api/v1/agent-runs/:runId/stop`

Stops a run.

#### `POST /api/v1/agent-runs/:runId/resume`

Attempts resume from a stopped or waiting state when valid.

### 3.7 Provider Status

#### `GET /api/v1/providers`

Returns normalized provider and model availability state.

Response:

```json
{
  "providers": [
    {
      "id": "prv_openrouter",
      "name": "OpenRouter",
      "status": "degraded",
      "models": [
        {
          "id": "mdl_deepseek_free",
          "eligible": false,
          "cooldownUntil": "2026-07-04T10:15:00Z"
        }
      ]
    }
  ]
}
```

## 4. Streaming Events

### 4.1 Chat Stream Events

Example event types:

- `message.started`
- `message.delta`
- `message.completed`
- `provider.switched`
- `conversation.blocked_capacity`
- `conversation.error`

Example:

```json
{
  "type": "provider.switched",
  "conversationId": "con_001",
  "fromModel": "mdl_deepseek_free",
  "toModel": "mdl_nemotron_free",
  "reason": "quota_exhausted"
}
```

### 4.2 Agent Stream Events

Example event types:

- `run.started`
- `run.state_changed`
- `run.tool_requested`
- `run.tool_result`
- `run.file_changed`
- `run.command_output`
- `run.provider_switched`
- `run.completed`
- `run.stopped`
- `run.blocked_capacity`

## 5. Companion Gateway Contracts

The desktop companion connects through a machine-authenticated realtime channel.

Inbound action payload example:

```json
{
  "type": "tool.request",
  "requestId": "req_001",
  "runId": "run_001",
  "workspaceId": "wrk_001",
  "tool": "read_file",
  "payload": {
    "path": "src/app.ts"
  }
}
```

Tool result example:

```json
{
  "type": "tool.result",
  "requestId": "req_001",
  "runId": "run_001",
  "status": "ok",
  "result": {
    "content": "console.log('hello');"
  },
  "durationMs": 42
}
```

## 6. Error Envelope

Standard API error:

```json
{
  "error": {
    "code": "CAPACITY_EXHAUSTED",
    "message": "All currently configured free models are unavailable.",
    "requestId": "req_api_001"
  }
}
```

## 7. API Versioning

- Prefix all routes with `/api/v1`.
- Add backward-compatible fields freely.
- Breaking changes require `/v2`.
