interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function normalizePart(part: unknown): string {
  if (part === undefined) return 'undefined';
  if (part === null) return 'null';
  if (typeof part === 'bigint') return `bigint:${part.toString()}`;
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

export function buildScopedCacheKey(scope: string, parts: unknown[]): string {
  return `${scope}:${parts.map(normalizePart).join(':')}`;
}

export function getScopedCacheValue<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setScopedCacheValue<T>(key: string, value: T, ttlMs: number): T {
  cache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlMs)
  });
  return value;
}

export async function withScopedSingleFlight<T>(
  key: string,
  producer: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return await existing as T;
  const promise = producer();
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export async function withScopedCache<T>(params: {
  key: string;
  ttlMs: number;
  producer: () => Promise<T>;
}): Promise<T> {
  const cached = getScopedCacheValue<T>(params.key);
  if (cached !== null) return cached;
  return await withScopedSingleFlight(params.key, async () => {
    const fresh = await params.producer();
    return setScopedCacheValue(params.key, fresh, params.ttlMs);
  });
}

export function clearScopedCache(scope?: string): void {
  if (!scope) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${scope}:`)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(`${scope}:`)) inflight.delete(key);
  }
}
