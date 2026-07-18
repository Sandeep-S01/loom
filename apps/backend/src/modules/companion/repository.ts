import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import type {
  CompanionStatusResponse,
  PairCompleteRequest,
  PairCompleteResponse,
  PairStartResponse,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import { auditEvents, devices } from "../../db/schema.js";
import { badRequest, conflict, unauthorized } from "../../lib/http-errors.js";
import { getRedis, type RedisClient } from "../../redis/client.js";
import { redisKeys } from "../../redis/keys.js";

const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;

export interface CompanionRepository {
  createPairingChallenge(userId: string): Promise<PairStartResponse>;
  completePairing(input: PairCompleteRequest): Promise<PairCompleteResponse>;
  getCompanionStatus(userId: string): Promise<CompanionStatusResponse>;
  resolveMachineSession(input: {
    deviceId: string;
    machineSessionToken: string;
  }): Promise<{ userId: string; deviceId: string }>;
}

export interface PairingChallengeRecord {
  pairingCode: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface CompanionDeviceRecord {
  id: string;
  userId: string;
  deviceType?: string;
  machineLabel: string | null;
  machineFingerprintHash: string | null;
  machineSessionTokenHash?: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface CreateInMemoryCompanionRepositoryOptions {
  now?: () => Date;
  challengeTtlMs?: number;
  tokenFactory?: () => string;
  sharedDevices?: CompanionDeviceRecord[];
  sharedConnectionStates?: Map<string, string | null>;
  initialState?: {
    challenges?: PairingChallengeRecord[];
    devices?: CompanionDeviceRecord[];
    connectionStates?: Record<string, string | null>;
  };
}

export interface CreateDatabaseCompanionRepositoryOptions {
  now?: () => Date;
  challengeTtlMs?: number;
  tokenFactory?: () => string;
  redis?: RedisClient;
}

function createMachineSessionToken() {
  return `machine_${randomUUID()}`;
}

function hashMachineSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isMachineSessionTokenMatch(rawToken: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const candidateHash = hashMachineSessionToken(rawToken);
  const candidateBuffer = Buffer.from(candidateHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  return (
    candidateBuffer.length === storedBuffer.length &&
    timingSafeEqual(candidateBuffer, storedBuffer)
  );
}

function resolveNow(now?: () => Date) {
  return now ?? (() => new Date());
}

function isConnectionValueConnected(value: string | null) {
  if (!value) {
    return false;
  }

  if (value === "1" || value === "true" || value === "connected") {
    return true;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed.connected === true;
  } catch {
    return false;
  }
}

function createChallengeRecord(
  userId: string,
  ttlMs: number,
  now: Date,
): PairingChallengeRecord {
  return {
    pairingCode: generateId("pairingCode"),
    userId,
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    usedAt: null,
  };
}

function validateChallengeRecord(
  record: PairingChallengeRecord | null,
  now: Date,
): PairingChallengeRecord {
  if (!record) {
    throw badRequest("Pairing code is invalid");
  }

  if (record.usedAt) {
    throw conflict("Pairing code has already been used");
  }

  if (Date.parse(record.expiresAt) <= now.getTime()) {
    throw badRequest("Pairing code has expired");
  }

  return record;
}

function getChallengeTtlSeconds(expiresAt: string, now: Date) {
  const ttlMs = Date.parse(expiresAt) - now.getTime();
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

function toPairStartResponse(record: PairingChallengeRecord): PairStartResponse {
  return {
    pairingCode: record.pairingCode,
    expiresAt: record.expiresAt,
  };
}

export function createInMemoryCompanionRepository(
  options: CreateInMemoryCompanionRepositoryOptions = {},
): CompanionRepository {
  const now = resolveNow(options.now);
  const tokenFactory = options.tokenFactory ?? createMachineSessionToken;
  const challengeTtlMs = options.challengeTtlMs ?? DEFAULT_PAIRING_TTL_MS;
  const challenges = new Map(
    (options.initialState?.challenges ?? []).map((challenge) => [
      challenge.pairingCode,
      { ...challenge },
    ]),
  );
  const deviceItems =
    options.sharedDevices ??
    (options.initialState?.devices ?? []).map((device) => ({
      ...device,
    }));
  const connectionStates =
    options.sharedConnectionStates ??
    new Map(Object.entries(options.initialState?.connectionStates ?? {}));

  return {
    async createPairingChallenge(userId) {
      const record = createChallengeRecord(userId, challengeTtlMs, now());
      challenges.set(record.pairingCode, record);
      return toPairStartResponse(record);
    },
    async completePairing(input) {
      const currentTime = now();
      const record = validateChallengeRecord(
        challenges.get(input.pairingCode) ?? null,
        currentTime,
      );
      const machineSessionToken = tokenFactory();
      const machineSessionTokenHash = hashMachineSessionToken(machineSessionToken);

      record.usedAt = currentTime.toISOString();
      challenges.set(record.pairingCode, record);

      let device = deviceItems.find(
        (item) =>
          item.userId === record.userId &&
          item.machineFingerprintHash === input.machineFingerprintHash,
      );

      if (device) {
        device.machineLabel = input.machineLabel;
        device.machineSessionTokenHash = machineSessionTokenHash;
        device.lastSeenAt = currentTime.toISOString();
      } else {
        device = {
          id: generateId("device"),
          userId: record.userId,
          deviceType: "desktop_companion",
          machineLabel: input.machineLabel,
          machineFingerprintHash: input.machineFingerprintHash,
          machineSessionTokenHash,
          lastSeenAt: currentTime.toISOString(),
          createdAt: currentTime.toISOString(),
        };
        deviceItems.unshift(device);
      }

      connectionStates.set(
        device.id,
        JSON.stringify({
          connected: true,
          machineLabel: device.machineLabel,
        }),
      );

      return {
        deviceId: device.id,
        machineSessionToken,
      };
    },
    async getCompanionStatus(userId) {
      const device =
        deviceItems
          .filter((item) => item.userId === userId)
          .sort((left, right) => {
            const leftKey = left.lastSeenAt ?? left.createdAt;
            const rightKey = right.lastSeenAt ?? right.createdAt;
            return rightKey.localeCompare(leftKey);
          })[0] ?? null;

      if (!device) {
        return {
          connected: false,
          machineLabel: null,
          deviceId: null,
        };
      }

      return {
        connected: isConnectionValueConnected(connectionStates.get(device.id) ?? null),
        machineLabel: device.machineLabel,
        deviceId: device.id,
      };
    },
    async resolveMachineSession(input) {
      const device = deviceItems.find((item) => item.id === input.deviceId) ?? null;
      if (
        !device ||
        device.deviceType !== "desktop_companion" ||
        !isMachineSessionTokenMatch(
          input.machineSessionToken,
          device.machineSessionTokenHash,
        )
      ) {
        throw unauthorized("Invalid companion machine session.");
      }

      return {
        userId: device.userId,
        deviceId: device.id,
      };
    },
  };
}

export function createDatabaseCompanionRepository(
  options: CreateDatabaseCompanionRepositoryOptions = {},
): CompanionRepository {
  const now = resolveNow(options.now);
  const tokenFactory = options.tokenFactory ?? createMachineSessionToken;
  const challengeTtlMs = options.challengeTtlMs ?? DEFAULT_PAIRING_TTL_MS;
  const redis = options.redis ?? getRedis();

  return {
    async createPairingChallenge(userId) {
      const record = createChallengeRecord(userId, challengeTtlMs, now());

      await redis.set(
        redisKeys.pairingChallenge(record.pairingCode),
        JSON.stringify(record),
        "EX",
        getChallengeTtlSeconds(record.expiresAt, now()),
      );

      return toPairStartResponse(record);
    },
    async completePairing(input) {
      const db = getDb();
      const currentTime = now();
      const key = redisKeys.pairingChallenge(input.pairingCode);
      const machineSessionToken = tokenFactory();
      const machineSessionTokenHash = hashMachineSessionToken(machineSessionToken);
      const rawRecord = await redis.getdel(key);
      const record = validateChallengeRecord(
        rawRecord ? (JSON.parse(rawRecord) as PairingChallengeRecord) : null,
        currentTime,
      );

      const deviceId = await db.transaction(async (tx) => {
        const existingDevice = await tx.query.devices.findFirst({
          where: and(
            eq(devices.userId, record.userId),
            eq(devices.deviceType, "desktop_companion"),
            eq(devices.machineFingerprintHash, input.machineFingerprintHash),
          ),
          orderBy: [desc(devices.createdAt)],
        });

        const nextDeviceId = existingDevice?.id ?? generateId("device");

        if (existingDevice) {
          await tx
            .update(devices)
            .set({
              machineLabel: input.machineLabel,
              machineSessionTokenHash,
              lastSeenAt: currentTime,
            })
            .where(eq(devices.id, existingDevice.id));
        } else {
          await tx.insert(devices).values({
            id: nextDeviceId,
            userId: record.userId,
            deviceType: "desktop_companion",
            machineLabel: input.machineLabel,
            machineFingerprintHash: input.machineFingerprintHash,
            machineSessionTokenHash,
            lastSeenAt: currentTime,
            createdAt: currentTime,
          });
        }

        await tx.insert(auditEvents).values({
          id: generateId("auditEvent"),
          userId: record.userId,
          deviceId: nextDeviceId,
          eventType: "companion_paired",
          subjectType: "device",
          subjectId: nextDeviceId,
          payloadJson: {
            machineLabel: input.machineLabel,
          },
          createdAt: currentTime,
        });

        return nextDeviceId;
      });

      return {
        deviceId,
        machineSessionToken,
      };
    },
    async getCompanionStatus(userId) {
      const db = getDb();
      const device = await db.query.devices.findFirst({
        where: and(
          eq(devices.userId, userId),
          eq(devices.deviceType, "desktop_companion"),
        ),
        orderBy: [desc(devices.lastSeenAt), desc(devices.createdAt)],
      });

      if (!device) {
        return {
          connected: false,
          machineLabel: null,
          deviceId: null,
        };
      }

      const connectionValue = await redis.get(redisKeys.companionConnection(device.id));

      return {
        connected: isConnectionValueConnected(connectionValue),
        machineLabel: device.machineLabel,
        deviceId: device.id,
      };
    },
    async resolveMachineSession(input) {
      const db = getDb();
      const device = await db.query.devices.findFirst({
        where: and(
          eq(devices.id, input.deviceId),
          eq(devices.deviceType, "desktop_companion"),
        ),
        orderBy: [desc(devices.createdAt)],
      });

      if (
        !device ||
        !isMachineSessionTokenMatch(
          input.machineSessionToken,
          device.machineSessionTokenHash,
        )
      ) {
        throw unauthorized("Invalid companion machine session.");
      }

      return {
        userId: device.userId,
        deviceId: device.id,
      };
    },
  };
}
