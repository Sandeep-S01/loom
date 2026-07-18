# Observability and Alerts

## Metrics

Set `METRICS_ENABLED=true` and configure a random `METRICS_TOKEN` of at least 32 characters. Scrape `GET /metrics` with `Authorization: Bearer <token>`. Never expose this endpoint through the public ingress without authentication.

The endpoint publishes bounded-label HTTP request counts/latency, provider attempt counts/latency, failover counts, dependency readiness, eligible model count, and Node.js process metrics. Conversation, user, request, trace, and model IDs are intentionally excluded from labels to prevent cardinality growth.

## Initial alert policy

| Condition | Window | Severity |
| --- | --- | --- |
| Readiness unavailable | 2 minutes | Critical |
| Eligible chat models = 0 | 1 minute | Critical |
| HTTP 5xx rate > 5% | 5 minutes | Critical |
| Provider failure rate > 20% | 5 minutes | Warning |
| Failover rate > 10% | 10 minutes | Warning |
| API p95 > 2 seconds, excluding chat sends | 10 minutes | Warning |
| Chat/provider p95 > 90 seconds | 10 minutes | Critical |

Tune thresholds after two weeks of beta traffic. Logs remain the source for per-request routing traces; metrics are the aggregate alerting source.

## Retention

Production runs bounded cleanup according to `RETENTION_CLEANUP_*` and `*_RETENTION_DAYS`. Raw usage/provider attempts default to 30 days and audit events to 90 days. Hourly/daily usage rollups are retained. Each run deletes at most the configured batch per table, avoiding long table locks.

Monitor `retention.cleanup_completed` and `retention.cleanup_failed` structured log events. Repeated full batches indicate the cleanup interval or batch size needs tuning.
