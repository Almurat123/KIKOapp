import {
  acquireLock as redisAcquireLock,
  connectRedis,
  del as redisDel,
  get as redisGet,
  incrBy as redisIncrBy,
  releaseLock as redisReleaseLock,
  set as redisSet,
  setIfNotExists as redisSetIfNotExists,
  redis,
} from './redis.js';

export async function connect(): Promise<boolean> {
  return connectRedis();
}

export const initRedis = connect;
export { connectRedis, redis };

export async function get(key: string): Promise<string | null> {
  return redisGet(key);
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  return redisSet(key, value, ttlSeconds);
}

export async function del(key: string): Promise<void> {
  return redisDel(key);
}

export async function setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  return redisSetIfNotExists(key, value, ttlSeconds);
}

export async function incrBy(key: string, amount: number, ttlSeconds?: number): Promise<number> {
  return redisIncrBy(key, amount, ttlSeconds);
}

export async function acquireLock(key: string, ttlSeconds: number, value: string): Promise<boolean> {
  return redisAcquireLock(key, ttlSeconds, value);
}

export async function releaseLock(key: string, value: string): Promise<void> {
  return redisReleaseLock(key, value);
}

export async function getJson<T = unknown>(key: string): Promise<T | null> {
  const raw = await get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  await set(key, JSON.stringify(value), ttlSeconds);
}

export function isRedisAvailable(): boolean {
  const client = redis as any;
  return !!client && !!client.isOpen && !!client.isReady;
}

const cacheClient = {
  connect,
  get,
  set,
  del,
  setIfNotExists,
  incrBy,
  acquireLock,
  releaseLock,
  getJson,
  setJson,
  isRedisAvailable,
  get client() {
    return redis;
  },
};

export default cacheClient;
