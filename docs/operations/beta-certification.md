# Beta Certification and Tester Handoff

## Automated release evidence

The following must be green for the exact release commit:

- repository typecheck, unit tests, lint, backend/web builds, and production dependency audit
- companion CI build on a runner with Rust and Tauri system dependencies
- Playwright authentication, admin, conversation CRUD, model switching, failover, and mobile tests
- staging Compose and Prometheus rule validation
- `certify-staging.ps1` output showing healthy database/Redis, admin access, eligible models, and authenticated metrics
- backup checksum and a restore drill completed against a disposable database

Store image digests, certification JSON, load-test JSON, migration logs, and backup checksum with the release record.

Generate a draft evidence manifest at any time:

```powershell
./scripts/deployment/release-candidate.ps1 -Candidate rc-2026.07.1 -Mode Draft
```

`Create` mode requires a clean worktree, the companion CI run URL, existing immutable images, and reruns all automated gates before writing the checksummed manifest.

## Tester scope

1. Authentication: invalid login, valid login, logout, expired session, and customer/admin authorization boundaries.
2. Chat: new conversation, text and supported image prompts, retry, rename, pin, share, delete, and page refresh persistence.
3. Models: exact selector/registry consistency, manual switching, provider attribution, rate-limit failover, cooldown, and recovery.
4. Admin: registry CRUD, connection test failures, last-active-model protection, marketplace sync, analytics, and routing diagnostics.
5. Companion/workspaces: pairing, reconnect, folder registration, offline state, and authorization failures.
6. Responsive/accessibility: keyboard navigation, visible focus, sidebar states, mobile overflow, zoom, and contrast.
7. Failure UX: database/provider/Redis interruption, all-model outage, slow responses, duplicate send prevention, and recovery.

## Exit criteria

- no open P0 or P1 defect
- no data loss, duplicate assistant response, authorization bypass, or secret exposure
- successful rollback rehearsal using previous image digests
- alerts observed for provider failure, zero eligible models, and dependency outage
- product owner, QA lead, and engineering owner sign off on the recorded evidence

Use `qa-test-run-template.md` for execution and `defect-triage-template.md` for every release finding.

Before handing a build to testers, run the Phase 9 freeze checklist in `release-freeze-checklist.md`.
