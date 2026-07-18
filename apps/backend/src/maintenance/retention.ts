import { sql } from "drizzle-orm";
import { getDb } from "../db/connection.js";

export type RetentionTarget =
  | "model_usage_events"
  | "provider_attempts"
  | "audit_events"
  | "browser_sessions"
  | "chat_idempotency_keys";

export interface RetentionPolicy {
  modelUsageDays: number;
  providerAttemptDays: number;
  auditDays: number;
  expiredSessionGraceDays: number;
  expiredIdempotencyGraceDays: number;
  batchSize: number;
}

export interface RetentionCleanupResult {
  deleted: Record<RetentionTarget, number>;
  totalDeleted: number;
}

export interface RetentionCleanupService {
  run(now?: Date): Promise<RetentionCleanupResult>;
}

type DeleteBatch = (target: RetentionTarget, cutoff: Date, batchSize: number) => Promise<number>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function createRetentionCleanupService(options: {
  policy: RetentionPolicy;
  deleteBatch?: DeleteBatch;
}): RetentionCleanupService {
  const policy = normalizeRetentionPolicy(options.policy);
  const deleteBatch = options.deleteBatch ?? deleteDatabaseBatch;

  return {
    async run(now = new Date()) {
      const targets: Array<[RetentionTarget, number]> = [
        ["model_usage_events", policy.modelUsageDays],
        ["provider_attempts", policy.providerAttemptDays],
        ["audit_events", policy.auditDays],
        ["browser_sessions", policy.expiredSessionGraceDays],
        ["chat_idempotency_keys", policy.expiredIdempotencyGraceDays],
      ];
      const deleted = Object.fromEntries(
        targets.map(([target]) => [target, 0]),
      ) as Record<RetentionTarget, number>;

      for (const [target, ageDays] of targets) {
        const cutoff = new Date(now.getTime() - ageDays * DAY_MS);
        deleted[target] = await deleteBatch(target, cutoff, policy.batchSize);
      }

      return {
        deleted,
        totalDeleted: Object.values(deleted).reduce((total, count) => total + count, 0),
      };
    },
  };
}

export function normalizeRetentionPolicy(policy: RetentionPolicy): RetentionPolicy {
  return {
    modelUsageDays: clampInteger(policy.modelUsageDays, 1, 3650),
    providerAttemptDays: clampInteger(policy.providerAttemptDays, 1, 3650),
    auditDays: clampInteger(policy.auditDays, 1, 3650),
    expiredSessionGraceDays: clampInteger(policy.expiredSessionGraceDays, 0, 365),
    expiredIdempotencyGraceDays: clampInteger(policy.expiredIdempotencyGraceDays, 0, 365),
    batchSize: clampInteger(policy.batchSize, 1, 10_000),
  };
}

async function deleteDatabaseBatch(
  target: RetentionTarget,
  cutoff: Date,
  batchSize: number,
): Promise<number> {
  const db = getDb();
  let result: unknown;

  switch (target) {
    case "model_usage_events":
      result = await db.execute(sql`
        with expired as (
          select id from model_usage_events where created_at < ${cutoff}
          order by created_at asc limit ${batchSize}
        )
        delete from model_usage_events using expired
        where model_usage_events.id = expired.id returning model_usage_events.id
      `);
      break;
    case "provider_attempts":
      result = await db.execute(sql`
        with expired as (
          select id from provider_attempts where started_at < ${cutoff}
          order by started_at asc limit ${batchSize}
        )
        delete from provider_attempts using expired
        where provider_attempts.id = expired.id returning provider_attempts.id
      `);
      break;
    case "audit_events":
      result = await db.execute(sql`
        with expired as (
          select id from audit_events where created_at < ${cutoff}
          order by created_at asc limit ${batchSize}
        )
        delete from audit_events using expired
        where audit_events.id = expired.id returning audit_events.id
      `);
      break;
    case "browser_sessions":
      result = await db.execute(sql`
        with expired as (
          select id from browser_sessions where expires_at < ${cutoff}
          order by expires_at asc limit ${batchSize}
        )
        delete from browser_sessions using expired
        where browser_sessions.id = expired.id returning browser_sessions.id
      `);
      break;
    case "chat_idempotency_keys":
      result = await db.execute(sql`
        with expired as (
          select id from chat_idempotency_keys where expires_at < ${cutoff}
          order by expires_at asc limit ${batchSize}
        )
        delete from chat_idempotency_keys using expired
        where chat_idempotency_keys.id = expired.id returning chat_idempotency_keys.id
      `);
      break;
  }

  return Array.isArray(result) ? result.length : 0;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
