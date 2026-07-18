import { describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "./validate-production-env.js";

describe("production environment validation", () => {
  it("accepts secure production dependencies and origins", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://loom:secret@db.internal/loom",
        REDIS_URL: "rediss://cache.internal:6380",
        FRONTEND_URL: "https://loom.example",
        ALLOW_DEV_SESSION: "false",
        METRICS_ENABLED: "true",
        METRICS_TOKEN: "a-secure-metrics-token-with-32-chars",
      }),
    ).not.toThrow();
  });

  it("rejects missing dependencies, insecure origins, and dev sessions", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "production",
        FRONTEND_URL: "http://loom.example",
        ALLOW_DEV_SESSION: "true",
      }),
    ).toThrow(/DATABASE_URL is required[\s\S]*REDIS_URL is required[\s\S]*must use HTTPS[\s\S]*ALLOW_DEV_SESSION/);
  });

  it("does not constrain non-production tooling", () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: "test" })).not.toThrow();
  });

  it("rejects an exposed production metrics endpoint", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://loom:secret@db.internal/loom",
        REDIS_URL: "redis://cache.internal:6379",
        FRONTEND_URL: "https://loom.example",
        METRICS_ENABLED: "true",
      }),
    ).toThrow(/METRICS_TOKEN/);
  });
});
