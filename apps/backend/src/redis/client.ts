import Redis from "ioredis";

export type RedisClient = Pick<Redis, "get" | "scan"> & {
  getdel(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "EX",
    durationSeconds: number,
  ): Promise<unknown>;
};

let redisInstance: Redis | null = null;

export function getRedis(): RedisClient {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is not configured");
    }

    redisInstance = new Redis(redisUrl, {
      connectTimeout: getPositiveEnvInt("REDIS_CONNECT_TIMEOUT_MS", 3_000),
      maxRetriesPerRequest: 1,
    });
  }

  return redisInstance;
}

export async function checkRedisConnection() {
  const response = await (getRedis() as Redis).ping();
  if (response !== "PONG") {
    throw new Error("Redis ping failed");
  }
}

export async function closeRedisConnection() {
  const client = redisInstance;
  redisInstance = null;
  if (client) {
    await client.quit();
  }
}

function getPositiveEnvInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
