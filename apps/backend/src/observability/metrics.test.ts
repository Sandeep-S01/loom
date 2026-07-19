import { describe, expect, it } from "vitest";
import { createOperationalMetrics } from "./metrics.js";

describe("operational metrics", () => {
  it("records bounded request, provider, failover, and dependency metrics", async () => {
    const metrics = createOperationalMetrics({ collectProcessMetrics: false });
    metrics.observeHttp({
      method: "POST",
      route: "/api/v1/conversations/:conversationId/messages",
      statusCode: 200,
      durationMs: 125,
    });
    metrics.observeProviderAttempt({
      providerId: "prv_e2e",
      status: "failed",
      failureCode: "provider_5xx",
      fallbackUsed: true,
      latencyMs: 500,
    });
    metrics.setDependencyStatus("database", true);
    metrics.setEligibleModels(2);
    metrics.observeRoutingAttempt({
      mode: "chat",
      status: "no_eligible_models",
      reasonCode: "runtime_unavailable",
    });
    metrics.observeDiscoveryJob({
      providerId: "prv_e2e",
      status: "failed",
      triggerType: "scheduled",
      durationMs: 2_000,
    });

    const output = await metrics.render();
    expect(output).toContain('loom_http_requests_total{method="POST",route="/api/v1/conversations/:conversationId/messages",status_code="200",service="loom_backend"} 1');
    expect(output).toContain('loom_provider_attempts_total{provider_id="prv_e2e",status="failed",failure_code="provider_5xx",fallback="true",service="loom_backend"} 1');
    expect(output).toContain('loom_provider_failovers_total{provider_id="prv_e2e",status="failed",service="loom_backend"} 1');
    expect(output).toContain('loom_dependency_healthy{dependency="database",service="loom_backend"} 1');
    expect(output).toContain("loom_eligible_chat_models{service=\"loom_backend\"} 2");
    expect(output).toContain('loom_routing_attempts_total{mode="chat",status="no_eligible_models",reason_code="runtime_unavailable",service="loom_backend"} 1');
    expect(output).toContain('loom_discovery_jobs_total{provider_id="prv_e2e",status="failed",trigger_type="scheduled",service="loom_backend"} 1');
    expect(output).not.toContain("conversationId=");
  });
});
