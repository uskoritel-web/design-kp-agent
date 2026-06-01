import { Redis } from '@upstash/redis';

const memoryStore = new Map<string, unknown>();

function getRedis(): Redis | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

export async function saveKP(id: string, data: unknown): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`kp:${id}`, data, { ex: 60 * 60 * 24 * 60 });
  } else {
    memoryStore.set(id, data);
  }
}

export async function loadKP(id: string): Promise<unknown | null> {
  const redis = getRedis();
  if (redis) {
    return await redis.get(`kp:${id}`);
  }
  return memoryStore.get(id) ?? null;
}
