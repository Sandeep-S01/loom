import type { ProviderFailureCode } from "./types.js";

/**
 * Failure-code → cooldown duration in milliseconds.
 *
 * Rationale:
 *  - rate_limited_transient: transient 429, retry after a short window
 *  - quota_exhausted: daily/billing quota, long cooldown
 *  - provider_5xx: server-side issue, moderate wait
 *  - auth_invalid: key misconfiguration, long cooldown (won't self-heal)
 *  - policy_blocked: content filter / policy, long cooldown
 *  - invalid_response: unexpected body, short retry
 *  - provider_unreachable: network issue, moderate wait
 */
const COOLDOWN_DURATION_MS: Record<ProviderFailureCode, number> = {
  rate_limited_transient: 30_000,
  quota_exhausted: 5 * 60_000,
  provider_5xx: 60_000,
  auth_invalid: 10 * 60_000,
  policy_blocked: 10 * 60_000,
  invalid_response: 15_000,
  provider_unreachable: 60_000,
};

interface CooldownEntry {
  until: number; // epoch ms
  failureCode: ProviderFailureCode;
}

export interface CooldownTracker {
  /** Mark a model as cooled-down after a failure. */
  markCooldown(modelId: string, failureCode: ProviderFailureCode): void;

  /** Check whether a model is currently in cooldown. */
  isInCooldown(modelId: string): boolean;

  /** Return a snapshot of active cooldowns as modelId → expiry epoch ms. */
  getCooldownMap(): Map<string, number>;

  /** Clear all cooldown entries (mainly for testing). */
  clear(): void;
}

export function createCooldownTracker(): CooldownTracker {
  const entries = new Map<string, CooldownEntry>();

  function pruneExpired() {
    const now = Date.now();
    for (const [modelId, entry] of entries) {
      if (entry.until <= now) {
        entries.delete(modelId);
      }
    }
  }

  return {
    markCooldown(modelId, failureCode) {
      const durationMs = COOLDOWN_DURATION_MS[failureCode] ?? 15_000;
      entries.set(modelId, {
        until: Date.now() + durationMs,
        failureCode,
      });
    },

    isInCooldown(modelId) {
      const entry = entries.get(modelId);
      if (!entry) return false;
      if (entry.until <= Date.now()) {
        entries.delete(modelId);
        return false;
      }
      return true;
    },

    getCooldownMap() {
      pruneExpired();
      const result = new Map<string, number>();
      for (const [modelId, entry] of entries) {
        result.set(modelId, entry.until);
      }
      return result;
    },

    clear() {
      entries.clear();
    },
  };
}

/**
 * Singleton instance shared across all request handlers in this process.
 * Resets on server restart — acceptable for V1.
 */
export const globalCooldownTracker = createCooldownTracker();
