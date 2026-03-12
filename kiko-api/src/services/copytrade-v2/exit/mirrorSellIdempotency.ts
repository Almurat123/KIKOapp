import { del as cacheDel, get as cacheGet, isRedisAvailable, set as cacheSet, setIfNotExists } from '../../../cache/cacheClient.js';

type ExitFinalityState = 'confirmed_success' | 'pending_visibility' | 'retryable_unresolved' | 'confirmed_failed';

const inflightKeys = new Set<string>();
const retryCooldownUntil = new Map<string, number>();
const DEFAULT_MIN_RETRY_INTERVAL_MS = Math.max(1_000, Number(process.env.COPYTRADE_MIRROR_SELL_MIN_RETRY_INTERVAL_MS || '12000'));
const REDIS_INFLIGHT_TTL_SEC = Math.max(60, Number(process.env.COPYTRADE_MIRROR_SELL_INFLIGHT_TTL_SEC || '180'));

export interface MirrorSellIdempotencyClaim {
  allowed: boolean;
  keys: string[];
  blockedReason?: 'inflight' | 'cooldown';
  retryAfterMs?: number;
}

function inflightRedisKey(key: string): string {
  return `copytrade:mirror_sell:inflight:${key}`;
}

function cooldownRedisKey(key: string): string {
  return `copytrade:mirror_sell:cooldown:${key}`;
}

function normalizeHash(txHash?: string | null): string {
  return String(txHash || '').trim().toLowerCase();
}

function normalizePositionId(positionId?: string | null): string {
  return String(positionId || '').trim();
}

export function buildMirrorSellIdempotencyKeys(params: {
  positionIds: string[];
  targetSellTxHash?: string | null;
}): string[] {
  const txHash = normalizeHash(params.targetSellTxHash);
  if (!txHash) return [];
  const keys = params.positionIds
    .map((id) => normalizePositionId(id))
    .filter(Boolean)
    .map((id) => `${id}:${txHash}`);
  return [...new Set(keys)];
}

export async function claimMirrorSellIdempotency(params: {
  keys: string[];
  minRetryIntervalMs?: number;
  nowMs?: number;
}): Promise<MirrorSellIdempotencyClaim> {
  const keys = [...new Set(params.keys.filter(Boolean))];
  if (keys.length === 0) return { allowed: true, keys: [] };

  const nowMs = Number(params.nowMs || Date.now());
  const minRetryIntervalMs = Math.max(1_000, Number(params.minRetryIntervalMs || DEFAULT_MIN_RETRY_INTERVAL_MS));

  for (const key of keys) {
    if (inflightKeys.has(key)) {
      return {
        allowed: false,
        keys,
        blockedReason: 'inflight',
      };
    }
    const cooldownUntil = Number(retryCooldownUntil.get(key) || 0);
    if (cooldownUntil > nowMs) {
      return {
        allowed: false,
        keys,
        blockedReason: 'cooldown',
        retryAfterMs: Math.max(1, cooldownUntil - nowMs),
      };
    }
  }

  if (isRedisAvailable()) {
    for (const key of keys) {
      const inflightValue = await cacheGet(inflightRedisKey(key)).catch(() => null);
      if (inflightValue) {
        return {
          allowed: false,
          keys,
          blockedReason: 'inflight',
        };
      }
      const cooldownRaw = await cacheGet(cooldownRedisKey(key)).catch(() => null);
      const cooldownUntil = Number(cooldownRaw || 0);
      if (cooldownUntil > nowMs) {
        return {
          allowed: false,
          keys,
          blockedReason: 'cooldown',
          retryAfterMs: Math.max(1, cooldownUntil - nowMs),
        };
      }
    }
  }

  const claimedRedisKeys: string[] = [];
  for (const key of keys) {
    if (isRedisAvailable()) {
      const claimed = await setIfNotExists(inflightRedisKey(key), String(nowMs), REDIS_INFLIGHT_TTL_SEC).catch(() => false);
      if (!claimed) {
        for (const claimedKey of claimedRedisKeys) {
          await cacheDel(inflightRedisKey(claimedKey)).catch(() => { });
        }
        return {
          allowed: false,
          keys,
          blockedReason: 'inflight',
        };
      }
      claimedRedisKeys.push(key);
    }
    inflightKeys.add(key);
    retryCooldownUntil.set(key, nowMs + minRetryIntervalMs);
  }

  return { allowed: true, keys };
}

export async function settleMirrorSellIdempotency(params: {
  keys: string[];
  finalityState: ExitFinalityState;
  nowMs?: number;
  minRetryIntervalMs?: number;
}): Promise<void> {
  const keys = [...new Set(params.keys.filter(Boolean))];
  if (keys.length === 0) return;
  const nowMs = Number(params.nowMs || Date.now());
  const minRetryIntervalMs = Math.max(1_000, Number(params.minRetryIntervalMs || DEFAULT_MIN_RETRY_INTERVAL_MS));
  const cooldownUntil = nowMs + minRetryIntervalMs;
  const cooldownTtlSec = Math.max(1, Math.ceil(minRetryIntervalMs / 1000));

  for (const key of keys) {
    inflightKeys.delete(key);
    if (isRedisAvailable()) {
      await cacheDel(inflightRedisKey(key)).catch(() => { });
    }
    if (params.finalityState === 'confirmed_success' || params.finalityState === 'confirmed_failed') {
      retryCooldownUntil.delete(key);
      if (isRedisAvailable()) {
        await cacheDel(cooldownRedisKey(key)).catch(() => { });
      }
      continue;
    }
    retryCooldownUntil.set(key, cooldownUntil);
    if (isRedisAvailable()) {
      await cacheSet(cooldownRedisKey(key), String(cooldownUntil), cooldownTtlSec).catch(() => { });
    }
  }
}

export function resetMirrorSellIdempotencyStateForTests(): void {
  inflightKeys.clear();
  retryCooldownUntil.clear();
}
