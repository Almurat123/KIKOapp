import { del as cacheDel, get as cacheGet, isRedisAvailable, set as cacheSet, setIfNotExists } from '../../../cache/cacheClient.js';

const inflightKeys = new Set<string>();
const retryCooldownUntil = new Map<string, number>();
const DEFAULT_MIN_RETRY_INTERVAL_MS = 60_000;
const REDIS_INFLIGHT_TTL_SEC = Math.max(60, Number(process.env.COPYTRADE_EXIT_INFLIGHT_TTL_SEC || '180'));

export interface ExitIntentClaimResult {
  allowed: boolean;
  blockedReason?: 'inflight' | 'cooldown';
  retryAfterMs?: number;
}

function inflightRedisKey(identityKey: string): string {
  return `copytrade:exit:inflight:${identityKey}`;
}

function cooldownRedisKey(identityKey: string): string {
  return `copytrade:exit:cooldown:${identityKey}`;
}

export async function claimExitIntentExecution(params: {
  identityKey: string;
  minRetryIntervalMs?: number;
  nowMs?: number;
}): Promise<ExitIntentClaimResult> {
  const identityKey = String(params.identityKey || '').trim();
  if (!identityKey) return { allowed: false, blockedReason: 'inflight' };
  const nowMs = Number(params.nowMs || Date.now());
  const minRetryIntervalMs = Math.max(1_000, Number(params.minRetryIntervalMs || DEFAULT_MIN_RETRY_INTERVAL_MS));

  if (inflightKeys.has(identityKey)) {
    return { allowed: false, blockedReason: 'inflight' };
  }
  const cooldownUntil = Number(retryCooldownUntil.get(identityKey) || 0);
  if (cooldownUntil > nowMs) {
    return {
      allowed: false,
      blockedReason: 'cooldown',
      retryAfterMs: Math.max(1, cooldownUntil - nowMs),
    };
  }

  if (isRedisAvailable()) {
    const inflightValue = await cacheGet(inflightRedisKey(identityKey)).catch(() => null);
    if (inflightValue) {
      return { allowed: false, blockedReason: 'inflight' };
    }
    const cooldownRaw = await cacheGet(cooldownRedisKey(identityKey)).catch(() => null);
    const redisCooldown = Number(cooldownRaw || 0);
    if (redisCooldown > nowMs) {
      return {
        allowed: false,
        blockedReason: 'cooldown',
        retryAfterMs: Math.max(1, redisCooldown - nowMs),
      };
    }
    const claimed = await setIfNotExists(inflightRedisKey(identityKey), String(nowMs), REDIS_INFLIGHT_TTL_SEC).catch(() => false);
    if (!claimed) {
      return { allowed: false, blockedReason: 'inflight' };
    }
  }

  inflightKeys.add(identityKey);
  retryCooldownUntil.set(identityKey, nowMs + minRetryIntervalMs);
  return { allowed: true };
}

export async function settleExitIntentExecution(params: {
  identityKey: string;
  finalityState: 'confirmed_success' | 'pending_visibility' | 'retryable_unresolved' | 'confirmed_failed';
  minRetryIntervalMs?: number;
  nowMs?: number;
}): Promise<void> {
  const identityKey = String(params.identityKey || '').trim();
  if (!identityKey) return;
  const nowMs = Number(params.nowMs || Date.now());
  const minRetryIntervalMs = Math.max(1_000, Number(params.minRetryIntervalMs || DEFAULT_MIN_RETRY_INTERVAL_MS));
  const cooldownUntil = nowMs + minRetryIntervalMs;
  const cooldownTtlSec = Math.max(1, Math.ceil(minRetryIntervalMs / 1000));

  inflightKeys.delete(identityKey);
  if (isRedisAvailable()) {
    await cacheDel(inflightRedisKey(identityKey)).catch(() => undefined);
  }

  if (params.finalityState === 'confirmed_success' || params.finalityState === 'confirmed_failed') {
    retryCooldownUntil.delete(identityKey);
    if (isRedisAvailable()) {
      await cacheDel(cooldownRedisKey(identityKey)).catch(() => undefined);
    }
    return;
  }

  retryCooldownUntil.set(identityKey, cooldownUntil);
  if (isRedisAvailable()) {
    await cacheSet(cooldownRedisKey(identityKey), String(cooldownUntil), cooldownTtlSec).catch(() => undefined);
  }
}

export function resetExitIntentIdempotencyStateForTests(): void {
  inflightKeys.clear();
  retryCooldownUntil.clear();
}
