# Incident Response

## Provider Outage

1. Confirm failures in routing diagnostics and identify the affected model/provider.
2. Verify automatic failover and cooldown behavior.
3. Disable an authentication-invalid model from the admin registry.
4. Escalate only when all eligible models are exhausted or error rates remain elevated.

## Database or Redis Outage

1. Check `/api/v1/health/live`; a healthy response confirms the process is running.
2. Check `/api/v1/health/ready` to identify the unavailable dependency.
3. Remove unready instances from traffic; do not restart repeatedly while the dependency is down.
4. Restore dependency service, verify readiness, then run one idempotent chat request.

## Suspected Credential Exposure

1. Revoke and rotate the affected provider/database/session credential immediately.
2. Disable affected models until their secret references are updated.
3. Review structured logs and audit events by request ID without copying secrets into tickets.
4. Run repository secret scanning and invalidate active browser sessions when session material may be affected.

## Evidence

Capture release commit, image digest, request/routing IDs, timestamps, affected model IDs, readiness output, and remediation actions. Do not capture raw prompts, cookies, authorization headers, or provider keys.
