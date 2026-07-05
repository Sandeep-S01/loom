# Security Design

## 1. Security Objectives

- Protect provider secrets.
- Constrain local-machine access to a user-approved workspace.
- Preserve auditability of model routing and local actions.
- Prevent the web client from gaining uncontrolled filesystem power.

## 2. Trust Boundaries

### Browser

- Untrusted for secrets.
- Untrusted for direct filesystem actions.
- Trusted only as a user-intent surface once authenticated.

### Backend

- Trusted for secret storage, policy enforcement, persistence, and routing.

### Desktop Companion

- Trusted for local execution only within the selected workspace boundary.
- Must not receive provider API keys.

## 3. Threat Model

### Threats in Scope

- Provider key leakage.
- Unauthorized local file access outside selected root.
- Path traversal and symlink escape.
- Command misuse through agent execution.
- Session hijacking.
- Sensitive data leakage into logs.
- Replay of pairing credentials.

### Threats Deferred But Not Ignored

- Supply-chain compromise of external providers.
- Full local-machine malware compromise.
- Insider multi-user abuse, since V1 is single-user.

## 4. Controls

## 4.1 Secret Management

- Store provider credentials in encrypted server-side secret storage.
- Restrict secret access to backend runtime only.
- Rotate credentials through admin-only flows.
- Never persist provider secrets in frontend bundles or companion storage.

## 4.2 Session Security

- Use secure, HttpOnly session cookies.
- Enable CSRF protection on state-changing web endpoints.
- Set strict same-site policy where compatible.
- Track session creation and logout in audit logs.

## 4.3 Companion Pairing Security

- Pair using short-lived signed pairing tokens.
- Bind paired machine sessions to machine identity metadata.
- Expire idle companion sessions.
- Allow companion revocation.

## 4.4 Workspace Boundary Enforcement

- Canonicalize every requested path.
- Validate every resulting path remains under selected root.
- Deny operations that resolve outside root.
- Deny symlink-based escapes.
- Execute commands with working directory set to root.

## 4.5 Logging and Audit

- Audit folder selection, file mutation, file deletion, command execution, provider switch, login, logout, and configuration changes.
- Redact known secret patterns from logs.
- Avoid logging full file contents unless operationally required.

## 4.6 Transport Security

- Require HTTPS/TLS for browser-backend and companion-backend communication.
- Reject plaintext production transport.

## 5. Authorization Model

V1 has one user, but the service should still enforce explicit ownership:

- Conversations belong to a user.
- Workspaces belong to a user and device.
- Agent runs belong to a user through workspace and conversation association.

This avoids security rewrites when multi-user support is added later.

## 6. Secure Failure Handling

- On provider auth failure, immediately disable the affected model from routing and raise an alert.
- On invalid companion token, disconnect and log.
- On boundary violation attempt, deny, log, and return structured error.
- On database failure, stop new mutating runs rather than processing partially.

## 7. Security Requirements by Surface

### Web App

- No provider secrets.
- No direct local file APIs.
- Minimal persisted client state.

### Backend

- Centralized validation.
- Rate limiting.
- Input sanitization.
- Secret redaction.

### Desktop Companion

- Minimal local credential storage.
- Strict workspace boundary enforcement.
- Safe command execution defaults.

## 8. Recommended Security Backlog After V1

- Signed companion update verification.
- Optional destructive-action confirmation policy.
- Detailed command allow/deny policy.
- Security event alerting.
- Periodic secret scanning of logs and traces.
