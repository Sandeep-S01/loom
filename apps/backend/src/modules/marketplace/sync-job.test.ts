import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerMarketplaceSyncJob } from "./sync-job.js";
import type { MarketplaceService } from "./service.js";

describe("marketplace sync job", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs startup sync without throwing provider errors through Fastify", async () => {
    vi.useFakeTimers();
    const app = Fastify({ logger: false });
    const service = {
      syncOpenRouterFreeModels: vi.fn(async () => {
        throw new Error("catalog unavailable");
      }),
      listFreeModels: vi.fn(),
      enableFreeModel: vi.fn(),
      disableFreeModel: vi.fn(),
    } as unknown as MarketplaceService;

    registerMarketplaceSyncJob(app, service, {
      intervalMs: 0,
      runOnStartup: true,
    });

    await app.ready();
    await vi.runAllTimersAsync();
    await app.close();

    expect(service.syncOpenRouterFreeModels).toHaveBeenCalledTimes(1);
  });

  it("does not register work when disabled", async () => {
    vi.useFakeTimers();
    const app = Fastify({ logger: false });
    const service = {
      syncOpenRouterFreeModels: vi.fn(),
      listFreeModels: vi.fn(),
      enableFreeModel: vi.fn(),
      disableFreeModel: vi.fn(),
    } as unknown as MarketplaceService;

    registerMarketplaceSyncJob(app, service, {
      intervalMs: 0,
      runOnStartup: false,
    });

    await app.ready();
    await vi.runAllTimersAsync();
    await app.close();

    expect(service.syncOpenRouterFreeModels).not.toHaveBeenCalled();
  });
});
