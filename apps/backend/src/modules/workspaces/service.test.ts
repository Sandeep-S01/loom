import { describe, expect, it } from "vitest";
import { badRequest } from "../../lib/http-errors.js";
import { createInMemoryWorkspacesRepository } from "./repository.js";
import { createWorkspacesService } from "./service.js";

describe("workspaces service", () => {
  it("lists known workspaces for the current user", async () => {
    const service = createWorkspacesService({
      repository: createInMemoryWorkspacesRepository({
        initialState: {
          workspaces: [
            {
              id: "ws_user",
              userId: "usr_seeded",
              machineId: "dev_seeded",
              alias: "backend",
              canonicalPathHash: "sha256:path-a",
              displayPathHint: "D:/Personal_Project/clm_tool",
              status: "active",
              createdAt: "2026-07-04T09:00:00.000Z",
              updatedAt: "2026-07-04T09:05:00.000Z",
              lastUsedAt: "2026-07-04T09:05:00.000Z",
            },
            {
              id: "ws_other",
              userId: "usr_other",
              machineId: "dev_other",
              alias: "other",
              canonicalPathHash: "sha256:path-b",
              displayPathHint: "D:/Other",
              status: "active",
              createdAt: "2026-07-04T08:00:00.000Z",
              updatedAt: "2026-07-04T08:05:00.000Z",
              lastUsedAt: "2026-07-04T08:05:00.000Z",
            },
          ],
        },
      }),
    });

    await expect(service.listForUser("usr_seeded")).resolves.toEqual({
      workspaces: [
        {
          id: "ws_user",
          alias: "backend",
          machineId: "dev_seeded",
          status: "active",
          displayPathHint: "D:/Personal_Project/clm_tool",
        },
      ],
    });
  });

  it("creates or updates a workspace binding", async () => {
    const service = createWorkspacesService({
      repository: createInMemoryWorkspacesRepository({
        now: () => new Date("2026-07-04T10:15:00.000Z"),
        initialState: {
          devices: [
            {
              id: "dev_seeded",
              userId: "usr_seeded",
              deviceType: "desktop_companion",
              machineLabel: "Devbox",
              machineFingerprintHash: "sha256:devbox",
              lastSeenAt: "2026-07-04T10:00:00.000Z",
              createdAt: "2026-07-04T09:00:00.000Z",
            },
          ],
          workspaces: [
            {
              id: "ws_existing",
              userId: "usr_seeded",
              machineId: "dev_seeded",
              alias: "old-name",
              canonicalPathHash: "sha256:path-a",
              displayPathHint: "D:/Old",
              status: "missing",
              createdAt: "2026-07-04T09:05:00.000Z",
              updatedAt: "2026-07-04T09:10:00.000Z",
              lastUsedAt: "2026-07-04T09:10:00.000Z",
            },
          ],
        },
      }),
    });

    await expect(
      service.selectWorkspace("usr_seeded", {
        machineId: "dev_seeded",
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      }),
    ).resolves.toEqual({
      workspace: {
        id: "ws_existing",
        alias: "backend",
        machineId: "dev_seeded",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("rejects an unknown machine for the current user", async () => {
    const service = createWorkspacesService({
      repository: createInMemoryWorkspacesRepository(),
    });

    await expect(
      service.selectWorkspace("usr_seeded", {
        machineId: "dev_missing",
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      }),
    ).rejects.toEqual(badRequest("Workspace machine is not paired for this user"));
  });
});
