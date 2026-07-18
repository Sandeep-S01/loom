import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBackendEnvFilePaths } from "./load-env.js";

describe("loadBackendEnv", () => {
  it("prioritizes repo root env files ahead of app-local env files", () => {
    const envPaths = getBackendEnvFilePaths().map((envPath) =>
      envPath.replace(/\\/g, "/"),
    );

    expect(envPaths).toEqual([
      expect.stringContaining("/clm_tool/.env.local"),
      expect.stringContaining("/clm_tool/.env"),
      expect.stringContaining("/clm_tool/apps/backend/.env.local"),
      expect.stringContaining("/clm_tool/apps/backend/.env"),
    ]);

    expect(path.basename(envPaths[0]!)).toBe(".env.local");
    expect(path.basename(envPaths[1]!)).toBe(".env");
  });
});
