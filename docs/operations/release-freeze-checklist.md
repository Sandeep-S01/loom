# Phase 9 Release Freeze Checklist

Use this checklist when converting the current working state into a controlled tester build. This phase is about evidence and release discipline, not feature work.

## 1. Freeze Scope

- [ ] Confirm no new product features are entering the release candidate.
- [ ] Confirm the release branch name, candidate name, and target tester group.
- [ ] Review `git status --short` and split the current worktree into intentional commits.
- [ ] Keep generated or local evidence files out of commits unless they are explicitly required release records.
- [ ] Confirm `.env`, runtime logs, local test outputs, and local release evidence are not committed.

Recommended branch naming:

```powershell
git switch -c release/rc-YYYY.MM.N
```

Recommended candidate naming:

```text
rc-YYYY.MM.N
```

## 2. Automated Gates

Run these gates on the exact release commit:

```powershell
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter '@clm/backend' build
pnpm --filter '@clm/web' build
pnpm audit --prod
pnpm typecheck:e2e
$env:E2E_REUSE_SERVER = "false"; pnpm test:e2e
```

Required CI evidence:

- [ ] backend and web tests green
- [ ] production builds green
- [ ] dependency audit green
- [ ] E2E suite green
- [ ] cross-browser nightly green
- [ ] companion desktop CI green

## 3. Staging Certification

Staging must use real staging infrastructure and real staging provider keys. Do not certify beta readiness with local dummy secrets.

```powershell
./scripts/deployment/staging.ps1 -Action Validate -EnvFile .env.staging
./scripts/deployment/staging.ps1 -Action Build -EnvFile .env.staging
./scripts/deployment/staging.ps1 -Action Migrate -EnvFile .env.staging
./scripts/deployment/staging.ps1 -Action Bootstrap -EnvFile .env.staging
./scripts/deployment/staging.ps1 -Action Up -EnvFile .env.staging -IncludeObservability
./scripts/deployment/certify-staging.ps1 -EnvFile .env.staging -EvidenceDirectory release-evidence
```

Certification must prove:

- [ ] `/api/v1/health/ready` is healthy
- [ ] database is connected
- [ ] Redis is connected
- [ ] admin access works
- [ ] at least one eligible chat model exists
- [ ] authenticated metrics endpoint works
- [ ] Prometheus targets are up
- [ ] alert rules load successfully

## 4. Manual QA Matrix

Use `docs/operations/qa-test-run-template.md` for the recorded run.

Minimum tester handoff scenarios:

- [ ] customer login, logout, expired session, and denied admin access
- [ ] admin login and admin console access
- [ ] new chat, send message, retry, copy, and regenerate
- [ ] image attachment send path with a model that supports images
- [ ] model selector shows exactly active eligible models
- [ ] manual model switching persists correctly for the send request
- [ ] provider failover emits a subtle switch notice and no duplicate assistant message
- [ ] full provider outage returns one clear user-facing error
- [ ] recent chat rename, delete, pin, and share
- [ ] settings/account dropdown actions
- [ ] workspace/companion offline and reconnect states
- [ ] responsive desktop, tablet, and mobile layouts
- [ ] keyboard focus states and icon-only button labels

## 5. Operational Drills

Record evidence for each drill:

- [ ] database backup created and checksum retained
- [ ] restore tested against a disposable database
- [ ] rollback script tested with previous image references
- [ ] provider 429/rate-limit behavior tested
- [ ] provider 5xx/failover behavior tested
- [ ] Redis outage behavior tested
- [ ] all-model outage behavior tested

## 6. Immutable Release Candidate

Only create an immutable RC after the worktree is clean and companion CI evidence exists.

```powershell
$env:COMPANION_CI_RUN_URL = "https://github.com/<org>/<repo>/actions/runs/<run-id>"
./scripts/deployment/release-candidate.ps1 `
  -Candidate rc-YYYY.MM.N `
  -Mode Create `
  -StagingEnvFile .env.staging
```

The generated manifest and `.sha256` are the release evidence record. Store them with the QA run, staging certification JSON, backup checksum, and CI run links.

## 7. Beta Launch Decision

Release to testers only when all are true:

- [ ] no open P0 defects
- [ ] no unresolved P1 defects affecting chat, auth, provider routing, billing/cost visibility, or admin controls
- [ ] staging certification passed on the exact release commit
- [ ] companion CI passed
- [ ] rollback drill passed
- [ ] product owner, QA owner, and engineering owner signed off

## Current Known Blockers

- The local worktree must be reviewed and committed before `release-candidate.ps1 -Mode Create` can pass.
- Companion CI evidence is required through `COMPANION_CI_RUN_URL`.
- Real staging secrets and provider keys must be used for final staging certification.
