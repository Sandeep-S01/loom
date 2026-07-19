import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiscoverableProvidersDiscoveryResult } from "../model-discovery/domain.js";
import type { ModelDiscoveryService } from "../model-discovery/interfaces.js";
import { registerModelDiscoveryScheduler } from "./discovery-scheduler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("model discovery scheduler", () => {
  it("runs startup discovery and prevents overlapping interval executions", async () => {
    vi.useFakeTimers();
    const app = Fastify({ logger: false });
    let resolveRun: (() => void) | undefined;
    const runDiscoverableProvidersDiscovery = vi.fn(
      () =>
        new Promise<DiscoverableProvidersDiscoveryResult>((resolve) => {
          resolveRun = () =>
            resolve({
              attemptedCount: 1,
              succeededCount: 1,
              failedCount: 0,
              jobs: [],
            });
        }),
    );

    registerModelDiscoveryScheduler(
      app,
      makeDiscoveryService({ runDiscoverableProvidersDiscovery }),
      {
        intervalMs: 10,
        runOnStartup: true,
      },
    );

    await vi.advanceTimersByTimeAsync(20);
    expect(runDiscoverableProvidersDiscovery).toHaveBeenCalledTimes(1);
    expect(runDiscoverableProvidersDiscovery).toHaveBeenCalledWith({
      triggerType: "internal",
      actorUserId: null,
    });

    resolveRun?.();
    await vi.advanceTimersByTimeAsync(10);
    expect(runDiscoverableProvidersDiscovery).toHaveBeenCalledTimes(2);
    expect(runDiscoverableProvidersDiscovery).toHaveBeenLastCalledWith({
      triggerType: "scheduled",
      actorUserId: null,
    });

    await app.close();
  });

  it("does not register work when disabled", async () => {
    vi.useFakeTimers();
    const app = Fastify({ logger: false });
    const runDiscoverableProvidersDiscovery = vi.fn();

    registerModelDiscoveryScheduler(
      app,
      makeDiscoveryService({ runDiscoverableProvidersDiscovery }),
      {
        intervalMs: 0,
        runOnStartup: false,
      },
    );

    await vi.runAllTimersAsync();
    await app.close();

    expect(runDiscoverableProvidersDiscovery).not.toHaveBeenCalled();
  });
});

function makeDiscoveryService(
  input: Pick<ModelDiscoveryService, "runDiscoverableProvidersDiscovery">,
): ModelDiscoveryService {
  return {
    listJobs: vi.fn(),
    getJob: vi.fn(),
    listProviderSyncStatus: vi.fn(),
    getProviderSyncStatus: vi.fn(),
    runProviderDiscovery: vi.fn(),
    runDiscoverableProvidersDiscovery: input.runDiscoverableProvidersDiscovery,
  };
}
