import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-errors.js";
import { createInMemoryCompanionRepository } from "./repository.js";
import { createCompanionService } from "./service.js";

describe("companion pairing", () => {
  it("creates a short-lived pairing challenge", async () => {
    const service = createCompanionService({
      repository: createInMemoryCompanionRepository({
        now: () => new Date("2026-07-04T12:00:00.000Z"),
      }),
    });

    const response = await service.startPairing("usr_seeded");

    expect(response.pairingCode).toMatch(/^pair_/);
    expect(response.expiresAt).toBe("2026-07-04T12:05:00.000Z");
  });

  it("rejects an expired pairing code", async () => {
    const service = createCompanionService({
      repository: createInMemoryCompanionRepository({
        now: () => new Date("2026-07-04T12:00:00.000Z"),
      }),
    });

    const challenge = await service.startPairing("usr_seeded");

    await expect(
      createCompanionService({
        repository: createInMemoryCompanionRepository({
          now: () => new Date("2026-07-04T12:06:00.000Z"),
          initialState: {
            challenges: [
              {
                pairingCode: challenge.pairingCode,
                userId: "usr_seeded",
                expiresAt: challenge.expiresAt,
                usedAt: null,
              },
            ],
          },
        }),
      }).completePairing({
        pairingCode: challenge.pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:expired",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Pairing code has expired",
    } satisfies Partial<HttpError>);
  });

  it("completes pairing and returns machine credentials", async () => {
    const repository = createInMemoryCompanionRepository({
      now: () => new Date("2026-07-04T12:00:00.000Z"),
    });
    const service = createCompanionService({
      repository,
    });

    const challenge = await service.startPairing("usr_seeded");
    const completion = await service.completePairing({
      pairingCode: challenge.pairingCode,
      machineLabel: "Devbox",
      machineFingerprintHash: "sha256:device",
    });

    expect(completion.deviceId).toMatch(/^dev_/);
    expect(completion.machineSessionToken).toMatch(/^machine_/);

    await expect(
      service.completePairing({
        pairingCode: challenge.pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      message: "Pairing code has already been used",
    } satisfies Partial<HttpError>);

    await expect(service.getStatus("usr_seeded")).resolves.toEqual({
      connected: true,
      machineLabel: "Devbox",
      deviceId: completion.deviceId,
    });
  });
});
