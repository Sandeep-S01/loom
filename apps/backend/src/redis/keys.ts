/**
 * Redis key helpers — structured key patterns from docs/DATABASE.md §3.
 */

const NAMESPACE = "clm";
const PROVIDER_COOLDOWN_PREFIX = `${NAMESPACE}:provider:cooldown:`;
const COMPANION_CONNECTION_PREFIX = `${NAMESPACE}:companion:connection:`;
const PAIRING_CHALLENGE_PREFIX = `${NAMESPACE}:companion:pairing:`;

export const redisKeys = {
  /** Provider cooldown TTL key. */
  providerCooldown: (modelId: string) =>
    `${PROVIDER_COOLDOWN_PREFIX}${modelId}`,

  /** Pattern used to enumerate provider cooldown keys. */
  providerCooldownPattern: () => `${PROVIDER_COOLDOWN_PREFIX}*`,

  /** Extract model id from a provider cooldown key. */
  parseProviderCooldownModelId: (key: string) =>
    key.startsWith(PROVIDER_COOLDOWN_PREFIX)
      ? key.slice(PROVIDER_COOLDOWN_PREFIX.length) || null
      : null,

  /** Provider recent failure count. */
  providerFailCount: (modelId: string) =>
    `${NAMESPACE}:provider:failcount:${modelId}`,

  /** Companion WebSocket connection state. */
  companionConnection: (deviceId: string) =>
    `${COMPANION_CONNECTION_PREFIX}${deviceId}`,

  /** Pattern used to enumerate companion connection keys. */
  companionConnectionPattern: () => `${COMPANION_CONNECTION_PREFIX}*`,

  /** Pairing challenge state for desktop companion activation. */
  pairingChallenge: (pairingCode: string) =>
    `${PAIRING_CHALLENGE_PREFIX}${pairingCode}`,

  /** Agent run execution lock. */
  runLock: (runId: string) => `${NAMESPACE}:run:lock:${runId}`,

  /** Active stream state. */
  streamState: (streamId: string) =>
    `${NAMESPACE}:stream:state:${streamId}`,

  /** User session store (used by connect-redis). */
  session: (sessionId: string) => `${NAMESPACE}:session:${sessionId}`,
} as const;
