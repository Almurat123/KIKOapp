import { buildScopedCacheKey, getScopedCacheValue, setScopedCacheValue, withScopedSingleFlight } from './cacheStore.js';

type FailureEntry = {
  kind: 'failure';
  message: string;
};

const FAILURE_KIND = 'failure';

function isFailureEntry(value: unknown): value is FailureEntry {
  return Boolean(value)
    && typeof value === 'object'
    && (value as FailureEntry).kind === FAILURE_KIND
    && typeof (value as FailureEntry).message === 'string';
}

export async function withRpcReadBudget<T>(params: {
  scope: string;
  parts: unknown[];
  successTtlMs: number;
  failureCooldownMs: number;
  producer: () => Promise<T>;
}): Promise<T> {
  const key = buildScopedCacheKey(params.scope, params.parts);
  const cached = getScopedCacheValue<T | FailureEntry>(key);
  if (cached !== null) {
    if (isFailureEntry(cached)) {
      throw new Error(cached.message);
    }
    return cached;
  }

  return await withScopedSingleFlight(key, async () => {
    const hot = getScopedCacheValue<T | FailureEntry>(key);
    if (hot !== null) {
      if (isFailureEntry(hot)) {
        throw new Error(hot.message);
      }
      return hot;
    }
    try {
      const fresh = await params.producer();
      return setScopedCacheValue(key, fresh, params.successTtlMs);
    } catch (error: any) {
      const message = error?.message || String(error);
      setScopedCacheValue<FailureEntry>(key, { kind: FAILURE_KIND, message }, params.failureCooldownMs);
      throw error;
    }
  });
}

export const __rpcReadBudgetTest = {
  isFailureEntry,
};
