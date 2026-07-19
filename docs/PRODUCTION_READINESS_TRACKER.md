# Production Readiness Tracker

This file tracks production-readiness changes after the architecture, database,
API, and module structure were frozen.

## Target

Bring each review area to roughly `8/10` readiness before full production use:

- Architecture
- Code quality
- Security
- Performance
- Reliability
- Scalability
- Test coverage
- Maintainability
- Documentation

## Change Log

### 2026-07-19 - CSRF hardening for browser session APIs

Status: verified.

Issue:
Cookie-authenticated unsafe browser requests relied mainly on SameSite cookies
and production Origin checks. That reduced CSRF risk but did not provide an
explicit token contract for authenticated mutations.

Impact:
State-changing APIs could be weaker than expected for a production SaaS
security posture.

Change:
- Added a non-HTTP-only `loom_csrf` cookie issued by the backend for `/api/v1/*`
  browser requests.
- Added `x-csrf-token` validation for authenticated unsafe API methods.
- Kept bearer-based companion calls exempt from browser CSRF checks.
- Updated the web API helper to automatically echo the CSRF token on unsafe
  browser requests.
- Added backend and frontend regression tests.

Verification:
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend build`
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web test`
- `pnpm --filter @clm/web build`

Expected score impact:
- Security: `7/10 -> 8/10`
- Reliability: small improvement through clearer request rejection behavior.

### 2026-07-19 - Eligibility-safe selected model routing

Status: verified.

Issue:
The chat composer could send a selected model ID, but production Routing was
still free to choose the first eligible route. In addition, the production model
selector could continue exposing legacy model IDs while the finalized routing
stack operates on Registry model IDs.

Impact:
Users could choose one model and receive a response from another without a clear
eligibility-based reason. This made chat behavior less predictable and weakened
the separation between the legacy model path and the finalized Registry path.

Change:
- Added an optional preferred Registry model ID to the Routing contract.
- Updated Routing to select the preferred model only when it is present in the
  Eligibility result.
- Updated Chat to pass selected Registry model IDs into Routing.
- Updated the production selector path to return Eligibility-backed Registry
  models while preserving the legacy selector fallback for local/default app
  builds.
- Added Routing regression tests for eligible and ineligible preferred models.

Verification:
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend build`
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web test`
- `pnpm --filter @clm/web build`

Expected score impact:
- Architecture: `8/10 -> 8.3/10`
- Reliability: `7/10 -> 8/10`
- UI/UX predictability: improved model selector behavior.

### 2026-07-19 - Registry-aware chat persistence

Status: verified.

Issue:
Chat messages and provider attempts only had legacy `models.model_id`
references. Registry-routed chat could invoke approved Registry models, but the
system had to avoid writing those model IDs into legacy foreign-key columns,
which meant provider-attempt persistence lost Registry identity.

Impact:
Production diagnostics and persistence were incomplete for the finalized
Registry architecture. This also kept a fragile compatibility gap between chat
runtime behavior and the source-of-truth Model Registry.

Change:
- Added nullable `registry_model_id` references to `messages` and
  `provider_attempts`.
- Made `provider_attempts.model_id` nullable so Registry-only model attempts no
  longer require a synthetic legacy model row.
- Updated conversation persistence to read/write `registryModelId`.
- Updated provider-attempt recording to accept both legacy model IDs and
  Registry model IDs.
- Updated Chat to persist Registry identity for assistant messages and provider
  attempts.
- Kept legacy analytics writes limited to legacy model rows while the finalized
  Registry usage counters remain the source for new Registry usage.
- Added/updated regression coverage.

Verification:
- `pnpm --filter @clm/shared-types build`
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend build`
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web test`
- `pnpm --filter @clm/web build`

Expected score impact:
- Architecture: `8.3/10 -> 8.5/10`
- Reliability: `8/10 -> 8.2/10`
- Maintainability: `8/10 -> 8.3/10`

### 2026-07-19 - Chat composer accessibility hardening

Status: verified.

Issue:
Responsive browser QA found one icon-only chat control without an explicit
programmatic label. The visible UI was clear, but assistive technology and
automation could not reliably identify the send action.

Impact:
Keyboard and screen-reader users could encounter an unnamed control in the main
chat workflow, reducing accessibility readiness for the most important product
surface.

Change:
- Added an explicit `aria-label` to the chat composer send button.
- Extended the composer regression test so attachment, settings, model
  selection, and send controls all require accessible labels.

Verification:
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web test`
- `pnpm --filter @clm/web build`
- Authenticated desktop browser DOM scan across `/dashboard`, `/chat`,
  `/workspaces`, `/companion`, `/settings`, and `/admin` showed no horizontal
  overflow and no unnamed buttons or links.

Expected score impact:
- UI/UX accessibility: `7/10 -> 8/10`
- Test coverage: small improvement through composer accessibility regression
  coverage.

### 2026-07-19 - Tablet/mobile UI QA and auth-console cleanup

Status: verified.

Issue:
The initial responsive QA pass verified desktop but could not complete
tablet/mobile because the local dev server became stale after a production
build. A later tablet/mobile scan found the workspace mobile navigation trigger
was only 30x30 and the login/register silent session check produced an expected
401 browser console error for logged-out users.

Impact:
The small navigation trigger reduced touch ergonomics on tablet/mobile. The
expected 401 did not break the UI, but it created avoidable console noise in a
normal auth flow.

Change:
- Increased the workspace mobile navigation button hit area to 40x40.
- Added an optional session check path for auth pages that returns `204` when
  no session exists instead of throwing an expected authentication error.
- Updated the auth page to use the optional session check while leaving normal
  protected session APIs unchanged.
- Added backend and frontend regression tests.

Verification:
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend build`
- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web test`
- `pnpm --filter @clm/web build`
- Authenticated tablet and mobile browser scans across `/dashboard`, `/chat`,
  `/workspaces`, `/companion`, `/settings`, and `/admin` showed no horizontal
  overflow, no unnamed buttons or links, and no console errors.

Expected score impact:
- UI/UX accessibility: remains at `8/10` with responsive QA evidence.
- Reliability: small improvement through quieter normal auth flow.

### 2026-07-19 - Wide-desktop authenticated UI QA

Status: verified.

Issue:
Wide-desktop visual verification was the remaining UI QA gap after desktop,
tablet, and mobile scans were completed.

Impact:
Without a wide-desktop pass, large monitors could still hide layout drift such
as excessive stretch, unexpected overflow, or overlapping interactive controls.

Change:
- Ran authenticated wide-desktop browser QA at `1920x1080` across `/dashboard`,
  `/chat`, `/workspaces`, `/companion`, `/settings`, and `/admin`.

Verification:
- Wide-desktop scan showed no horizontal overflow.
- Wide-desktop scan showed no unnamed buttons or links.
- Wide-desktop scan showed no overlapping interactive controls.
- Wide-desktop scan showed no browser console errors.

Expected score impact:
- UI/UX accessibility: `8/10` verified across desktop, tablet, mobile, and wide
  desktop.

### 2026-07-19 - Routing and discovery operational metrics

Status: verified.

Issue:
The metrics endpoint already exposed HTTP, provider attempt, failover,
dependency, and eligible-model signals, but discovery outcomes and routing
decisions were visible mainly through logs/admin records instead of aggregate
metrics.

Impact:
Operations could alert on provider failures and dependency outages, but not
directly on discovery failures or rising `no_eligible_models` routing decisions.
Those are two of the most important early warning signals for the model
registry architecture.

Change:
- Added bounded Prometheus counters for routing decisions by mode/status/reason.
- Added bounded Prometheus counters and duration histograms for discovery jobs
  by provider/status/trigger.
- Wired metrics emission into Model Routing and Model Discovery after durable
  records are written.
- Added regression coverage for metric output and service-level metric emission.

Verification:
- `pnpm --filter @clm/backend typecheck`
- `pnpm --filter @clm/backend test`
- `pnpm --filter @clm/backend build`

Expected score impact:
- Reliability: `8.2/10 -> 8.4/10`
- Monitoring/operations: `7/10 -> 8/10`
- Production readiness: improved alertability for routing and discovery health.

## Open Readiness Items

1. UI responsive and accessibility QA
   - Completed for desktop, tablet, mobile, and wide-desktop authenticated
     routes.
   - Priority: complete.
   - Target areas: UI/UX, accessibility, maintainability.

2. Operational monitoring depth
   - Backend metrics now cover routing decisions, provider attempts/failovers,
     discovery jobs, dependency health, eligible model count, and HTTP latency.
   - Deployment dashboard/alert guidance is documented in
     `docs/operations/observability.md`.
   - Remaining: apply the documented dashboards/alerts in the production
     monitoring platform.
   - Priority: low-medium.
   - Target areas: reliability, monitoring, operations.

3. Documentation alignment
   - Update implementation notes once each hardening item is completed.
   - Priority: medium.
   - Target areas: documentation, maintainability.
