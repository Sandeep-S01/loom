# Production Release Runbook

## Preconditions

- The Phase 9 freeze checklist in `docs/operations/release-freeze-checklist.md` is complete.
- CI `verify`, `security`, `e2e`, `containers`, and `companion` jobs are green.
- Production secrets are configured outside source control.
- `/api/v1/health/ready` is green in the current environment.
- A PostgreSQL backup has been created and its checksum retained.

## Release

1. Copy `.env.staging.example` to `.env.staging`, replace every placeholder, and keep the file outside version control.
2. Validate the topology and alert rules: `./scripts/deployment/staging.ps1 -Action Validate`.
3. Create and checksum a database backup using `scripts/db/backup.ps1`.
4. Build immutable images and record their digests: `./scripts/deployment/staging.ps1 -Action Build`.
5. Run migrations as an explicit one-off job: `./scripts/deployment/staging.ps1 -Action Migrate`.
6. For a new environment only, create the initial admin and registry records with `./scripts/deployment/staging.ps1 -Action Bootstrap`. The operation is idempotent.
7. Start and certify staging, including Prometheus: `./scripts/deployment/staging.ps1 -Action Up -IncludeObservability`.
8. Run Playwright and the controlled outage scenarios against staging.
9. Shift traffic gradually and monitor request errors, provider failures, latency, readiness, and retention cleanup logs.

## Rollback

1. Stop traffic shifting immediately.
2. Redeploy the previous backend and web image digests.
3. Prefer a forward-fix migration when the new schema is backward compatible.
4. Restore the pre-release backup only when data/schema corruption prevents a forward fix.
5. Run readiness and the critical login/chat/admin smoke tests before reopening traffic.

For image rollback without deleting volumes:

```powershell
./scripts/deployment/rollback-staging.ps1 `
  -BackendImage registry.example/loom-backend:<previous-digest-or-tag> `
  -WebImage registry.example/loom-web:<previous-digest-or-tag> `
  -Confirm ROLLBACK
```

Drizzle migrations in this repository are forward-only. Never improvise a destructive down migration during an incident.

## Required Configuration

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_URL` or `FRONTEND_URLS`
- `ALLOW_DEV_SESSION=false`
- Provider secret environment references required by active models
- `METRICS_TOKEN` containing at least 32 URL-safe random characters
- unique database, Redis, admin, encryption, and companion secrets

The backend rejects startup when core production configuration is missing or unsafe.
