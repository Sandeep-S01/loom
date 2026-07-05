import { describe, expect, it, vi } from "vitest";

describe("dashboard redis helpers", () => {
  it("iterates companion connection keys with scan instead of KEYS", async () => {
    vi.resetModules();

    const scan = vi
      .fn()
      .mockResolvedValueOnce(["1", ["clm:companion:connection:dev_1"]])
      .mockResolvedValueOnce(["0", ["clm:companion:connection:dev_2"]]);
    const get = vi
      .fn()
      .mockResolvedValueOnce("{\"machineLabel\":\"Devbox 1\"}")
      .mockResolvedValueOnce("{\"machineLabel\":\"Devbox 2\"}");

    vi.doMock("./client.js", () => ({
      getRedis: vi.fn(() => ({
        scan,
        get,
      })),
    }));

    const { listCompanionConnectionEntries } = await import("./dashboard.js");
    const entries = await listCompanionConnectionEntries();

    expect(entries).toEqual([
      {
        key: "clm:companion:connection:dev_1",
        value: "{\"machineLabel\":\"Devbox 1\"}",
      },
      {
        key: "clm:companion:connection:dev_2",
        value: "{\"machineLabel\":\"Devbox 2\"}",
      },
    ]);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(scan).toHaveBeenNthCalledWith(
      1,
      "0",
      "MATCH",
      "clm:companion:connection:*",
      "COUNT",
      100,
    );
  });
});
