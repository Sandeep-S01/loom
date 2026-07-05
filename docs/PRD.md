# Product Requirements Document

## 1. Product Overview

The application is a single-user AI workspace with two modes:

- `Chat Mode`: available on mobile and desktop, similar to mainstream chat interfaces.
- `Agent Mode`: available on desktop only, requires selecting a local project folder through a desktop companion.

The system routes all model requests through a backend orchestration layer that can switch across multiple free LLM providers without forcing the user to manually restart their work.

## 2. Product Goals

- Deliver a reliable multi-provider free-model chat experience.
- Deliver a simple desktop local-agent experience for project-folder work.
- Make provider switching and quota exhaustion minimally disruptive.
- Keep security boundaries clear: provider keys in backend, file access on local machine.

## 3. Personas

### Persona A: Mobile Chat User

- Wants quick AI conversations on a phone.
- Does not need file or agent capabilities.
- Expects simple navigation and persistent chat history.

### Persona B: Desktop Builder

- Wants both chat and local code-agent assistance.
- Needs the agent to work directly on a selected local project folder.
- Expects clear visibility into what the agent is doing.

## 4. Functional Requirements

### 4.1 Authentication and Session

- FR-1: The system must support a single-user sign-in/session model for V1.
- FR-2: The user must remain signed in across browser sessions unless explicitly signed out.

### 4.2 Chat Mode

- FR-3: The user must be able to create, rename, archive, and resume chat conversations.
- FR-4: Messages must stream in near real time.
- FR-5: The backend must choose an eligible free model automatically.
- FR-6: If a model fails or hits limits, the backend must switch to another eligible model and continue in the same conversation.
- FR-7: The UI must optionally surface a lightweight note when a provider/model switch occurs.

### 4.3 Agent Mode

- FR-8: Agent mode must be available only on laptop/desktop form factors.
- FR-9: Agent mode must require a connected local desktop companion.
- FR-10: The user must choose a local project folder before submitting an agent task.
- FR-11: The agent must be able to inspect the folder tree, read files, create files, update files, delete files, and execute commands inside the selected root.
- FR-12: The UI must show a run timeline, progress events, changed files, and final outcome.
- FR-13: If the current model fails mid-run, the system must continue the run with another eligible model when possible.
- FR-14: The user must be able to stop an in-progress run.

### 4.4 Dashboard

- FR-15: The system must provide a landing dashboard with recent conversations, recent agent runs, current workspace status, and provider health summary.
- FR-16: The dashboard must surface whether the desktop companion is connected.
- FR-17: The dashboard must show the currently selected local project, if any.

### 4.5 Provider Orchestration

- FR-18: The system must maintain a normalized provider/model catalog.
- FR-19: The system must track provider attempts and failure reasons.
- FR-20: The system must apply cooldown behavior to repeatedly failing providers/models.
- FR-21: The system must stop and display a capacity message when no free models remain available.

### 4.6 Audit and History

- FR-22: The system must persist full conversation history.
- FR-23: The system must persist agent run summaries, step history, and file operation records.
- FR-24: The system must persist security-relevant audit events.

## 5. Non-Functional Requirements

### Performance

- NFR-1: Median chat response start time should be under 3 seconds excluding provider-side latency spikes.
- NFR-2: Failover should typically complete within 5 seconds after failure detection.
- NFR-3: Desktop companion connection status should refresh within 2 seconds.

### Reliability

- NFR-4: The system must tolerate intermittent provider outages without losing conversation state.
- NFR-5: Active agent runs must preserve enough execution state to show resumable or interrupted outcomes after backend restart.

### Security

- NFR-6: Provider API keys must never be exposed to clients.
- NFR-7: Local file operations must be root-scoped to the selected project folder.
- NFR-8: The system must log file mutations and command executions.

### Usability

- NFR-9: Mobile users must see a simplified chat-first experience.
- NFR-10: Desktop agent mode must be understandable without reading technical documentation.

## 6. User Stories

### Chat

- As a mobile user, I want to open the app and chat immediately without seeing desktop-only controls.
- As a desktop user, I want my chat to continue even if one free model becomes unavailable.
- As a user, I want my conversations saved so I can resume them later.

### Agent

- As a desktop user, I want to pick a local project folder before running an agent task.
- As a desktop user, I want to see what files the agent changed and what commands it ran.
- As a desktop user, I want the run to stop cleanly if no providers are available.

### Dashboard

- As a user, I want to know whether the desktop companion is connected.
- As a user, I want to review recent conversations and recent agent runs from one place.

## 7. Acceptance Criteria

### Chat Acceptance

- A conversation can be created and resumed.
- The backend can fail over between at least two configured free models without forcing a new conversation.
- When all models are unavailable, the UI shows a product message and keeps the conversation intact.

### Agent Acceptance

- Agent mode is hidden or disabled on mobile.
- Agent mode cannot start without a connected companion and selected folder.
- Agent operations remain inside the approved root and produce a visible event trail.
- A mid-run model failure can produce either continued execution through failover or a clean stopped state with logs preserved.

### Dashboard Acceptance

- Dashboard shows recent conversations, recent agent runs, and current companion status.

## 8. Assumptions

- The V1 user is technical enough to install a local companion.
- The product initially targets one trusted internal user account.
- Some provider/model combinations may vary in agent quality; routing policy will encode preferred order.

## 9. Future Expansion

- Multi-user accounts and teams.
- Paid fallback providers.
- Remote repositories and cloud workspaces.
- Rich approvals for destructive actions.
- Billing and usage quotas.

## 10. Required Skill Profiles

The application should expose two internal capability profiles for model routing:

### Chat Skill Profile

Required capabilities:

- conversational response quality
- long-context continuity
- instruction following
- concise summarization for failover handoff

### Agent Skill Profile

Required capabilities:

- planning
- code understanding
- file editing
- command reasoning
- debugging
- structured continuation after model switching

Only models meeting the agent profile should be eligible for agent mode routing.
