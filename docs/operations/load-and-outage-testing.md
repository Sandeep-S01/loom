# Load and Outage Validation

## Guardrails

The harness uses real API and provider calls. Run it only in staging, with dedicated provider keys, quotas, and a disposable test account. It caps execution at 500 requests and concurrency at 50 and requires `LOAD_TEST_CONFIRM=true`.

```powershell
$env:LOAD_TEST_CONFIRM="true"
$env:LOAD_TEST_BASE_URL="https://staging-api.example.com"
$env:LOAD_TEST_ORIGIN="https://staging.example.com" # optional CORS validation
$env:LOAD_TEST_EMAIL="load-test@example.com"
$env:LOAD_TEST_PASSWORD="..."
$env:LOAD_TEST_REQUESTS="50"
$env:LOAD_TEST_CONCURRENCY="5"
pnpm test:load
```

The command exits nonzero when the error-rate or p95 threshold is exceeded. It logs in, fetches the live selector, creates a conversation, sends an idempotent chat request, records failovers and latency, and deletes each test conversation.

## Release scenarios

1. Baseline: all providers healthy; verify error rate <=1% and expected model attribution.
2. Rate limit: constrain the preferred provider; verify immediate fallback, one assistant message, failover metrics, and toast metadata.
3. Provider 5xx: point the preferred driver at a controlled failure stub; verify circuit/cooldown behavior and no retry storm.
4. Full outage: disable all provider credentials in staging; verify one clear user error and no duplicate messages.
5. Recovery: restore the preferred provider after cooldown; verify it becomes eligible without restarting the app.
6. Saturation: exceed configured API concurrency with a controlled ramp; verify bounded 429/503 responses, stable memory, and recovery after traffic stops.

Capture the JSON report, metrics snapshot, application logs, database CPU/locks, and provider quota usage as release evidence.
