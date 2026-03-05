type ExitFinalityState = 'confirmed_success' | 'pending_visibility' | 'retryable_unresolved' | 'confirmed_failed';

const inflightKeys = new Set<string>();
const retryCooldownUntil = new Map<string, number>();
const DEFAULT_MIN_RETRY_INTERVAL_MS = 60_000;

export interface MirrorSellIdempotencyClaim {
  allowed: boolean;
  keys: string[];
  blockedReason?: 'inflight' | 'cooldown';
  retryAfterMs?: number;
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

export function claimMirrorSellIdempotency(params: {
  keys: string[];
  minRetryIntervalMs?: number;
  nowMs?: number;
}): MirrorSellIdempotencyClaim {
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

  for (const key of keys) {
    inflightKeys.add(key);
    retryCooldownUntil.set(key, nowMs + minRetryIntervalMs);
  }

  return { allowed: true, keys };
}

export function settleMirrorSellIdempotency(params: {
  keys: string[];
  finalityState: ExitFinalityState;
  nowMs?: number;
  minRetryIntervalMs?: number;
}): void {
  const keys = [...new Set(params.keys.filter(Boolean))];
  if (keys.length === 0) return;
  const nowMs = Number(params.nowMs || Date.now());
  const minRetryIntervalMs = Math.max(1_000, Number(params.minRetryIntervalMs || DEFAULT_MIN_RETRY_INTERVAL_MS));

  for (const key of keys) {
    inflightKeys.delete(key);
    if (params.finalityState === 'confirmed_success' || params.finalityState === 'confirmed_failed') {
      retryCooldownUntil.delete(key);
      continue;
    }
    retryCooldownUntil.set(key, nowMs + minRetryIntervalMs);
  }
}

export function resetMirrorSellIdempotencyStateForTests(): void {
  inflightKeys.clear();
  retryCooldownUntil.clear();
}

