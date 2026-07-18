import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerRetentionCleanupJob } from "./retention-job.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("retention cleanup job", () => {
  it("runs on startup and prevents overlapping cleanup executions", async () => {
    vi.useFakeTimers();
    const app = Fastify({ logger: false });
    let resolveRun: (() => void) | undefined;
    const run = vi.fn(() => new Promise<void>((resolve) => { resolveRun = resolve; }));

    registerRetentionCleanupJob(app, { run: run as never }, {
      intervalMs: 10,
      runOnStartup: true,
    });

    await vi.advanceTimersByTimeAsync(20);
    expect(run).toHaveBeenCalledTimes(1);
    resolveRun?.();
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(2);
    resolveRun?.();
    await app.close();
  });
});
