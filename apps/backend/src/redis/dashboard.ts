import { getRedis } from "./client.js";
import { redisKeys } from "./keys.js";

export interface RedisKeyValueEntry {
  key: string;
  value: string | null;
}

async function scanKeysByPattern(pattern: string): Promise<string[]> {
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

export async function listCompanionConnectionEntries(): Promise<RedisKeyValueEntry[]> {
  const redis = getRedis();
  const keys = await scanKeysByPattern(redisKeys.companionConnectionPattern());

  return Promise.all(
    keys.map(async (key) => ({
      key,
      value: await redis.get(key),
    })),
  );
}

export async function listProviderCooldownKeys(): Promise<string[]> {
  return scanKeysByPattern(redisKeys.providerCooldownPattern());
}
