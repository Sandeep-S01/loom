# Product Roadmap

## 1. Roadmap Principles

- Deliver continuity and local-agent safety before advanced features.
- Keep each milestone independently demonstrable.
- Avoid premature multi-user or billing complexity in V1.

## 2. Milestone 0: Foundations

Goals:

- Establish backend project structure.
- Establish frontend app shell.
- Establish database schema and seedable provider catalog.
- Establish desktop companion scaffold.

Outputs:

- Running web shell.
- Running backend API shell.
- Running desktop companion shell.
- Base database migrations.

## 3. Milestone 1: Chat Core

Goals:

- Build authentication/session flow.
- Build conversation and message persistence.
- Build streaming chat UI.
- Integrate first two free providers/models.
- Implement routing and failover basics.

Success:

- User can create and resume chats.
- System can auto-switch providers on forced failure.

## 4. Milestone 2: Dashboard and Provider Visibility

Goals:

- Build dashboard landing page.
- Add provider health summary.
- Add recent conversations and recent runs panels.
- Add capacity messaging and cooldown visibility.

Success:

- User can understand system status from one screen.

## 5. Milestone 3: Desktop Companion Pairing

Goals:

- Build pairing flow.
- Build connection-state tracking.
- Build native folder selector.
- Register workspace bindings.

Success:

- Desktop user can connect a local machine and select a workspace.

## 6. Milestone 4: Agent Execution MVP

Goals:

- Build agent run state machine.
- Implement file and command tool contracts.
- Build agent transcript, timeline, and changed-files UI.
- Persist run events and file operations.

Success:

- Desktop user can submit a task and see local execution progress.

## 7. Milestone 5: Reliability Hardening

Goals:

- Improve failover logic for mid-run agent switching.
- Add cooldown tuning.
- Improve structured execution summaries.
- Strengthen backend restart and disconnect handling.

Success:

- Runs degrade gracefully under provider instability and connection interruptions.

## 8. Milestone 6: Security Hardening

Goals:

- Complete audit coverage.
- Add log redaction rules.
- Add companion revocation.
- Add stricter path and symlink tests.

Success:

- Security review passes for V1 local-agent scope.

## 9. Post-MVP Opportunities

- Multi-user accounts.
- Paid provider fallback.
- Hosted sandboxes.
- Remote repositories.
- Approval policies for destructive agent steps.
- Rich diff visualization and git integration.
