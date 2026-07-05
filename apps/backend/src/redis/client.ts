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

    redisInstance = new Redis(redisUrl);
  }

  return redisInstance;
}
