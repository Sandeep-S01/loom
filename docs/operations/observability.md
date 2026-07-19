# Observability and Alerts

## Metrics

Set `METRICS_ENABLED=true` and configure a random `METRICS_TOKEN` of at least 32 characters. Scrape `GET /metrics` with `Authorization: Bearer <token>`. Never expose this endpoint through the public ingress without authentication.

The endpoint publishes bounded-label HTTP request counts/latency, provider attempt counts/latency, failover counts, routing decisions, discovery jobs/duration, dependency readiness, eligible model count, and Node.js process metrics. Conversation, user, request, trace, and model IDs are intentionally excluded from labels to prevent cardinality growth.

Core metric families:

| Metric | Purpose |
| --- | --- |
| `loom_http_requests_total` | Request volume by method, normalized route, and status code. |
| `loom_http_request_duration_seconds` | API latency by method, normalized route, and status code. |
| `loom_provider_attempts_total` | Provider/model invocation outcomes by provider, status, failure code, and fallback use. |
| `loom_provider_attempt_duration_seconds` | Provider invocation latency by provider and status. |
| `loom_provider_failovers_total` | Provider attempts made after an earlier attempt failed. |
| `loom_routing_attempts_total` | Routing decisions by mode, status, and no-eligible reason. |
| `loom_discovery_jobs_total` | Discovery job outcomes by provider, status, and trigger type. |
| `loom_discovery_job_duration_seconds` | Discovery job duration by provider and status. |
| `loom_dependency_healthy` | Dependency health for database, Redis, and provider registry. |
| `loom_eligible_chat_models` | Current eligible chat model count. |

## Starter dashboards

Create these dashboard sections before production traffic:

| Dashboard | Panels |
| --- | --- |
| API health | Request rate, 4xx/5xx rate, p50/p95/p99 HTTP latency, top failing routes. |
| Chat routing | Eligible model count, routing selections, `no_eligible_models` count by reason, failover rate. |
| Provider health | Provider attempts by provider/status, provider latency p95, failure code breakdown, fallback volume. |
| Discovery health | Discovery success/failure rate, latest failed provider, discovery duration p95, scheduled/manual trigger split. |
| Dependencies | Database/Redis/provider-registry health, backend process CPU/memory, restart count. |
| Retention jobs | Cleanup completion/failure events from logs, deleted-row batch size, repeated full batches. |

## Initial alert policy

| Condition | Window | Severity |
| --- | --- | --- |
| Readiness unavailable | 2 minutes | Critical |
| Eligible chat models = 0 | 1 minute | Critical |
| HTTP 5xx rate > 5% | 5 minutes | Critical |
| Provider failure rate > 20% | 5 minutes | Warning |
| Failover rate > 10% | 10 minutes | Warning |
| Routing `no_eligible_models` > 0 | 1 minute | Critical |
| Discovery failures > 0 | 30 minutes | Warning |
| Scheduled discovery has no successes | 24 hours | Warning |
| API p95 > 2 seconds, excluding chat sends | 10 minutes | Warning |
| Chat/provider p95 > 90 seconds | 10 minutes | Critical |

Tune thresholds after two weeks of beta traffic. Logs remain the source for per-request routing traces; metrics are the aggregate alerting source.

## Suggested PromQL

Adjust route names and windows to match the deployed Prometheus setup.

```promql
# HTTP 5xx rate
sum(rate(loom_http_requests_total{status_code=~"5.."}[5m]))
/
sum(rate(loom_http_requests_total[5m]))

# API p95 latency excluding chat sends
histogram_quantile(
  0.95,
  sum by (le) (
    rate(loom_http_request_duration_seconds_bucket{route!="/api/v1/conversations/:conversationId/messages"}[10m])
  )
)

# Provider failure rate
sum(rate(loom_provider_attempts_total{status="failed"}[5m]))
/
sum(rate(loom_provider_attempts_total[5m]))

# Failover rate
sum(rate(loom_provider_failovers_total[10m]))
/
sum(rate(loom_provider_attempts_total[10m]))

# No eligible routing decisions
sum(increase(loom_routing_attempts_total{status="no_eligible_models"}[1m]))

# Discovery failures
sum(increase(loom_discovery_jobs_total{status="failed"}[30m]))

# Chat/provider p95
histogram_quantile(
  0.95,
  sum by (le) (rate(loom_provider_attempt_duration_seconds_bucket[10m]))
)
```

## Alert routing

- Critical alerts page the operator responsible for backend/provider operations.
- Warning alerts create an operations ticket and should be reviewed within one business day during beta.
- Provider-specific failures should include the provider label, but not user, conversation, or request IDs.
- Per-request investigation should use structured logs and admin diagnostics, not high-cardinality metric labels.

## Retention

Production runs bounded cleanup according to `RETENTION_CLEANUP_*` and `*_RETENTION_DAYS`. Raw usage/provider attempts default to 30 days and audit events to 90 days. Hourly/daily usage rollups are retained. Each run deletes at most the configured batch per table, avoiding long table locks.

Monitor `retention.cleanup_completed` and `retention.cleanup_failed` structured log events. Repeated full batches indicate the cleanup interval or batch size needs tuning.
