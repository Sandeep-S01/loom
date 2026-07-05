import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();

vi.mock("../../db/connection.js", () => ({
  getDb,
}));

describe("workspaces repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses an atomic upsert for an existing user-machine-path binding", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "ws_existing" }]);
    const onConflictDoUpdate = vi.fn(() => ({
      returning,
    }));
    const workspaceInsertValues = vi.fn(() => ({
      onConflictDoUpdate,
    }));
    const auditInsertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        values: workspaceInsertValues,
      })
      .mockReturnValueOnce({
        values: auditInsertValues,
      });

    const db = {
      query: {
        devices: {
          findFirst: vi.fn().mockResolvedValue({
            id: "dev_seeded",
            userId: "usr_seeded",
            deviceType: "desktop_companion",
          }),
        },
        workspaces: {
          findFirst: vi.fn().mockResolvedValue({
            id: "ws_existing",
            userId: "usr_seeded",
            deviceId: "dev_seeded",
            alias: "backend",
            canonicalPathHash: "sha256:path-a",
            displayPathHint: "D:/Personal_Project/clm_tool",
            status: "active",
            createdAt: new Date("2026-07-04T10:15:00.000Z"),
            updatedAt: new Date("2026-07-04T10:15:00.000Z"),
            lastUsedAt: new Date("2026-07-04T10:15:00.000Z"),
          }),
        },
      },
      transaction: vi.fn(async (callback) =>
        callback({
          query: {
            workspaces: {
              findFirst: vi.fn(),
            },
          },
          insert,
        }),
      ),
    };

    getDb.mockReturnValue(db);

    const { createDatabaseWorkspacesRepository } = await import("./repository.js");
    const repository = createDatabaseWorkspacesRepository({
      now: () => new Date("2026-07-04T10:15:00.000Z"),
    });

    await repository.selectWorkspace("usr_seeded", {
      machineId: "dev_seeded",
      alias: "backend",
      canonicalPathHash: "sha256:path-a",
      displayPathHint: "D:/Personal_Project/clm_tool",
    });

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(returning).toHaveBeenCalledTimes(1);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }, 10000);
});
