import { inspect } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    query: {
      devices: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../../db/connection.js", () => ({
  getDb: () => dbMock,
}));

import { HttpError } from "../../lib/http-errors.js";
import {
  createDatabaseCompanionRepository,
  type PairingChallengeRecord,
} from "./repository.js";

describe("database companion repository", () => {
  beforeEach(() => {
    dbMock.query.devices.findFirst.mockReset();
    dbMock.insert.mockReset();
    dbMock.update.mockReset();
    dbMock.transaction.mockReset();

    dbMock.insert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
    dbMock.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }));
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) =>
      callback(dbMock),
    );
  });

  it("consumes a pairing challenge atomically so a replay fails after the first completion", async () => {
    const record: PairingChallengeRecord = {
      pairingCode: "pair_once",
      userId: "usr_seeded",
      expiresAt: "2026-07-04T12:05:00.000Z",
      usedAt: null,
    };
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn(),
      scan: vi.fn(),
      getdel: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify(record))
        .mockResolvedValueOnce(null),
    };
    dbMock.query.devices.findFirst.mockResolvedValue(null);

    const repository = createDatabaseCompanionRepository({
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      redis,
      tokenFactory: () => "machine_test_token",
    });

    const first = await repository.completePairing({
      pairingCode: "pair_once",
      machineLabel: "Devbox",
      machineFingerprintHash: "sha256:test",
    });

    expect(first.machineSessionToken).toBe("machine_test_token");
    expect(redis.getdel).toHaveBeenCalledWith("clm:companion:pairing:pair_once");

    await expect(
      repository.completePairing({
        pairingCode: "pair_once",
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:test",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Pairing code is invalid",
    } satisfies Partial<HttpError>);
  });

  it("limits the existing device lookup to desktop companion records", async () => {
    const record: PairingChallengeRecord = {
      pairingCode: "pair_scope",
      userId: "usr_seeded",
      expiresAt: "2026-07-04T12:05:00.000Z",
      usedAt: null,
    };
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn(),
      scan: vi.fn(),
      getdel: vi.fn().mockResolvedValue(JSON.stringify(record)),
    };
    dbMock.query.devices.findFirst.mockResolvedValue(null);

    const repository = createDatabaseCompanionRepository({
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      redis,
      tokenFactory: () => "machine_test_token",
    });

    await repository.completePairing({
      pairingCode: "pair_scope",
      machineLabel: "Devbox",
      machineFingerprintHash: "sha256:test",
    });

    const lookupArgs = dbMock.query.devices.findFirst.mock.calls[0]?.[0];
    const whereDump = inspect(lookupArgs?.where, { depth: 8 });

    expect(whereDump).toContain("device_type");
    expect(whereDump).toContain("desktop_companion");
  });
});
