import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

export interface ProviderMetricEvent {
  providerId: string;
  status: "success" | "failed";
  failureCode?: string | null;
  fallbackUsed: boolean;
  latencyMs: number;
}

export interface OperationalMetrics {
  readonly contentType: string;
  observeHttp(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void;
  observeProviderAttempt(event: ProviderMetricEvent): void;
  setDependencyStatus(dependency: "database" | "redis" | "provider_registry", healthy: boolean): void;
  setEligibleModels(count: number): void;
  render(): Promise<string>;
}

export function createOperationalMetrics(options: {
  collectProcessMetrics?: boolean;
} = {}): OperationalMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: "loom_backend" });

  if (options.collectProcessMetrics !== false) {
    collectDefaultMetrics({ prefix: "loom_", register: registry });
  }

  const httpRequests = new Counter({
    name: "loom_http_requests_total",
    help: "Total completed HTTP requests.",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
  });
  const httpDuration = new Histogram({
    name: "loom_http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 90],
    registers: [registry],
  });
  const providerAttempts = new Counter({
    name: "loom_provider_attempts_total",
    help: "Total provider invocation attempts.",
    labelNames: ["provider_id", "status", "failure_code", "fallback"] as const,
    registers: [registry],
  });
  const providerDuration = new Histogram({
    name: "loom_provider_attempt_duration_seconds",
    help: "Provider invocation duration in seconds.",
    labelNames: ["provider_id", "status"] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 40, 60, 90],
    registers: [registry],
  });
  const failovers = new Counter({
    name: "loom_provider_failovers_total",
    help: "Total provider attempts made after a previous model failed.",
    labelNames: ["provider_id", "status"] as const,
    registers: [registry],
  });
  const dependencyHealth = new Gauge({
    name: "loom_dependency_healthy",
    help: "Dependency health where 1 is healthy and 0 is unavailable.",
    labelNames: ["dependency"] as const,
    registers: [registry],
  });
  const eligibleModels = new Gauge({
    name: "loom_eligible_chat_models",
    help: "Current number of eligible chat models.",
    registers: [registry],
  });

  return {
    contentType: registry.contentType,
    observeHttp(input) {
      const labels = {
        method: input.method,
        route: normalizeRoute(input.route),
        status_code: String(input.statusCode),
      };
      httpRequests.inc(labels);
      httpDuration.observe(labels, Math.max(0, input.durationMs) / 1_000);
    },
    observeProviderAttempt(event) {
      const labels = {
        provider_id: normalizeBoundedLabel(event.providerId),
        status: event.status,
        failure_code: normalizeBoundedLabel(event.failureCode ?? "none"),
        fallback: event.fallbackUsed ? "true" : "false",
      };
      providerAttempts.inc(labels);
      providerDuration.observe(
        { provider_id: labels.provider_id, status: labels.status },
        Math.max(0, event.latencyMs) / 1_000,
      );
      if (event.fallbackUsed) {
        failovers.inc({ provider_id: labels.provider_id, status: labels.status });
      }
    },
    setDependencyStatus(dependency, healthy) {
      dependencyHealth.set({ dependency }, healthy ? 1 : 0);
    },
    setEligibleModels(count) {
      eligibleModels.set(Math.max(0, count));
    },
    render() {
      return registry.metrics();
    },
  };
}

function normalizeRoute(route: string) {
  if (!route || route === "*") return "unmatched";
  return route.slice(0, 160);
}

function normalizeBoundedLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "unknown";
}
