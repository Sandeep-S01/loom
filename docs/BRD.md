# Business Requirements Document

## 1. Executive Summary

The product is a single-user AI workspace that provides:

- Chat access to multiple free LLM providers through one interface.
- Automatic failover across free models when a provider hits quota, rate limits, or transient failure.
- Desktop-only agent capabilities that can read, create, update, and delete files inside a user-selected local project folder through a local desktop companion.
- A unified dashboard for conversations, agent runs, provider health, and workspace status.

The business goal is to remove friction caused by fragmented free-model access and provider exhaustion while offering a local-agent experience comparable in simplicity to Codex and Claude Code.

## 2. Problem Statement

Users who rely on free LLM APIs face four recurring problems:

1. They must manually switch between providers and models when limits are hit.
2. They lose conversation continuity when switching providers.
3. Existing chat products rarely combine mobile chat convenience with safe local code-agent workflows.
4. Local code agents are often hard to set up, overly technical, or expose too much system access.

The product addresses this by centralizing provider access, preserving context during failover, and separating chat from local agent execution.

## 3. Business Objectives

### Primary Objectives

- Provide uninterrupted chat and agent experiences across a pool of free LLM providers.
- Offer a simple, understandable desktop agent experience for local project work.
- Keep provider credentials on the backend and local file power on the user machine.
- Support both mobile and desktop from a single product surface.

### Secondary Objectives

- Build a foundation for future multi-user support.
- Build a normalized provider and model abstraction that can later support paid fallback tiers.
- Capture enough telemetry and audit history to debug routing, failover, and agent execution issues.

## 4. Scope

### In Scope for V1

- Single-user application.
- Responsive web dashboard.
- Mobile chat-only experience.
- Desktop chat plus agent experience.
- Backend-managed free-provider credentials.
- Automatic provider/model failover with context carry-forward.
- Local desktop companion for project selection and agent execution.
- Conversation history, agent run history, provider health visibility, and audit logging.
- Graceful stop with clear message when all configured free models are unavailable.

### Out of Scope for V1

- Multi-user tenancy and team workspaces.
- Paid provider fallback.
- Remote repository cloning and hosted sandboxes.
- Collaborative editing.
- Marketplace, plugin ecosystem, or third-party extensions.
- Fine-grained billing or usage metering for external customers.
- Voice, video, or image-generation features unless explicitly added later.

## 5. Stakeholders

### Internal Stakeholders

- Product owner.
- Lead engineer.
- Future frontend engineer.
- Future backend/platform engineer.
- Future desktop companion engineer.

### External Dependencies

- Free LLM providers and aggregators.
- Desktop OS APIs for folder selection and local execution.

## 6. Target User

V1 supports one internal user profile:

- A technically capable user who wants mobile chat access and desktop local-agent code assistance.
- The user values continuity, simple controls, and low setup friction more than deep customization in V1.

## 7. Business Requirements

### BR-1 Unified Access

The system must provide one product surface that exposes chat on all devices and agent mode on desktop only.

### BR-2 Provider Abstraction

The system must normalize multiple free LLM providers behind a backend router.

### BR-3 Automatic Continuity

The system must automatically continue a conversation or agent run using another eligible free model when the active model becomes unavailable.

### BR-4 Local Agent Safety

The system must execute agent actions only on the same user machine through a local companion and only inside a user-selected project root.

### BR-5 Backend Secret Ownership

The system must keep all provider credentials in backend-controlled secret storage and never expose them to the browser or desktop companion.

### BR-6 Clear Capacity Behavior

If all free models are unavailable, the system must stop cleanly and show a product-level capacity message rather than raw provider errors.

### BR-7 Auditability

The system must log provider switches, agent file operations, command executions, and security-relevant events.

## 8. Success Metrics

### Product Metrics

- Session continuity rate after provider failure.
- Percentage of requests auto-recovered through failover.
- Agent task completion rate.
- Time to first successful chat response.
- Time to first successful desktop companion connection.

### Operational Metrics

- Provider failure classification accuracy.
- Mean failover latency.
- Agent run interruption rate.
- Companion reconnect success rate.

## 9. Constraints

- V1 is single-user only.
- Agent execution is local-machine only.
- Mobile must not expose agent features.
- Free-provider behavior is unstable by definition, so orchestration must tolerate changing limits.
- The product must work even when the workspace repository is not a git repo.

## 10. Risks

- Free providers may change quotas or reliability frequently.
- Model capability differences may affect continuity quality after failover.
- Local desktop companion installation and pairing can become a usability bottleneck.
- Agent safety issues may arise from path traversal, symlinks, or unsafe command execution if boundaries are not enforced correctly.

## 11. Business Recommendation

Build V1 as a hybrid system:

- Web app for dashboard, chat, and orchestration visibility.
- Backend control plane for routing, persistence, and security.
- Local desktop companion for desktop-only project and agent capabilities.

This is the simplest architecture that satisfies the core product promise without violating local-access and backend-secret requirements.
