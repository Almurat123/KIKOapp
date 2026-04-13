import { get as cacheGet, set as cacheSet, del as cacheDel } from '../../../cache/cacheClient.js';
import type { DexStrategy, DirectSwapHint } from './types.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: DirectSwap reference quote cache previously persisted Kyber-specific fields and now must not revive them.
// Goal: Keep shared reference quote snapshots stable, 0x-only, and backward-safe for existing cache entries.
// Owns: Reference quote cache schema, Redis serialization, and inflight singleflight state.
// Does Not Own: Quote generation policy or provider selection.
// Design Language:
// - Cache schemas must only store supported provider fields.
// - Old Kyber fields are ignored on read and never written again.
// - Forbidden local patch patterns: expanding cache records to preserve removed provider state.
// Document Provenance:
// - Source: repository runtime audit of Kyber removal plan
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: direct-swap cache schema cleanup
// - Verification: verified in code
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-13-kyber-0x-only-removal.md
// - system-journal/owner-map/backend-swap-validation.md

interface TimedValue<T> {
  value: T;
  timestamp: number;
}

function isFresh(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp <= ttlMs;
}

export function createTimedCache<T>() {
  const store = new Map<string, TimedValue<T>>();

  return {
    get(key: string, ttlMs: number): T | null {
      const hit = store.get(key);
      if (!hit) return null;
      if (!isFresh(hit.timestamp, ttlMs)) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key: string, value: T): void {
      store.set(key, { value, timestamp: Date.now() });
    },
    del(key: string): void {
      store.delete(key);
    }
  };
}

export const v4SpotCache = new Map<string, TimedValue<bigint>>();
export const v4QuoterCache = new Map<string, TimedValue<bigint>>();
export const referenceQuoteCache = new Map<string, TimedValue<bigint>>();
export type ExternalReferenceQuoteSnapshot = {
  ref0x: bigint;
  best: bigint;
};
export const sharedExternalReferenceQuoteCache = new Map<string, TimedValue<ExternalReferenceQuoteSnapshot>>();
export const sharedExternalReferenceQuoteInflight = new Map<string, Promise<ExternalReferenceQuoteSnapshot>>();
export const noPoolNegativeCache = new Map<string, { reason: string; timestamp: number }>();
export const v4GasLimitCache = new Map<string, { gasLimit: string; timestamp: number }>();
export const winningRouteCache = new Map<string, { strategy: DexStrategy; timestamp: number }>();
export const singlePoolWinnerHintCache = new Map<string, { hint: NonNullable<DirectSwapHint['resolvedPoolHint']>; timestamp: number }>();

export function v4SpotRedisKey(cacheKey: string): string {
  return `directswap:v4spot:${cacheKey}`;
}

export function v4QuoterRedisKey(cacheKey: string): string {
  return `directswap:v4quoter:${cacheKey}`;
}

export function referenceQuoteRedisKey(cacheKey: string): string {
  return `directswap:refquote:${cacheKey}`;
}

export function sharedExternalReferenceQuoteRedisKey(cacheKey: string): string {
  return `directswap:refquote_shared:${cacheKey}`;
}

export function winningRouteCacheKey(chainId: number, tokenIn: string, tokenOut: string): string {
  return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

export function winningRouteRedisKey(cacheKey: string): string {
  return `directswap:winning_route:${cacheKey}`;
}

export function singlePoolWinnerHintRedisKey(cacheKey: string): string {
  return `directswap:single_pool_hint:${cacheKey}`;
}

export function v4GasCacheKey(chainId: number, poolId: string, tokenIn: string, tokenOut: string): string {
  return `${chainId}:${poolId.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

export function getNoPoolCacheKey(chainId: number, tokenIn: string, tokenOut: string): string {
  return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

export function noPoolRedisKey(chainId: number, tokenIn: string, tokenOut: string): string {
  return `directswap:nopool:${getNoPoolCacheKey(chainId, tokenIn, tokenOut)}`;
}

export function getCachedV4GasLimit(key: string, ttlMs: number): string | null {
  const hit = v4GasLimitCache.get(key);
  if (!hit) return null;
  if (!isFresh(hit.timestamp, ttlMs)) {
    v4GasLimitCache.delete(key);
    return null;
  }
  return hit.gasLimit;
}

export function setCachedV4GasLimit(key: string, gasLimit: string): void {
  v4GasLimitCache.set(key, { gasLimit, timestamp: Date.now() });
}

export async function getCachedWinningStrategy(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<DexStrategy | null> {
  const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
  const local = winningRouteCache.get(cacheKey);
  if (local && isFresh(local.timestamp, ttlMs)) {
    return local.strategy;
  }
  try {
    const raw = await cacheGet(winningRouteRedisKey(cacheKey));
    if (raw) {
      const fromRedis = JSON.parse(raw) as { kind?: DexStrategy['kind']; dex?: DexStrategy['dex'] };
      if (!fromRedis?.kind) return null;
      const strategy: DexStrategy = { kind: fromRedis.kind, dex: fromRedis.dex };
      winningRouteCache.set(cacheKey, { strategy, timestamp: Date.now() });
      return strategy;
    }
  } catch {
    // ignore cache errors
  }
  return null;
}

export async function setCachedWinningStrategy(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  strategy: DexStrategy,
  ttlSeconds: number
): Promise<void> {
  const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
  winningRouteCache.set(cacheKey, { strategy, timestamp: Date.now() });
  try {
    await cacheSet(
      winningRouteRedisKey(cacheKey),
      JSON.stringify({ kind: strategy.kind, dex: strategy.dex }),
      Math.max(30, Math.floor(ttlSeconds))
    );
  } catch {
    // ignore cache errors
  }
}

export async function getCachedSinglePoolWinnerHint(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<NonNullable<DirectSwapHint['resolvedPoolHint']> | null> {
  const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
  const local = singlePoolWinnerHintCache.get(cacheKey);
  if (local && isFresh(local.timestamp, ttlMs)) {
    return local.hint;
  }
  if (local) {
    singlePoolWinnerHintCache.delete(cacheKey);
  }
  try {
    const raw = await cacheGet(singlePoolWinnerHintRedisKey(cacheKey));
    if (!raw) return null;
    const fromRedis = JSON.parse(raw) as NonNullable<DirectSwapHint['resolvedPoolHint']>;
    if (!fromRedis?.kind || !fromRedis?.poolAddress) return null;
    singlePoolWinnerHintCache.set(cacheKey, { hint: fromRedis, timestamp: Date.now() });
    return fromRedis;
  } catch {
    return null;
  }
}

export async function setCachedSinglePoolWinnerHint(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  hint: NonNullable<DirectSwapHint['resolvedPoolHint']>,
  ttlSeconds: number
): Promise<void> {
  const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
  singlePoolWinnerHintCache.set(cacheKey, { hint, timestamp: Date.now() });
  try {
    await cacheSet(
      singlePoolWinnerHintRedisKey(cacheKey),
      JSON.stringify(hint),
      Math.max(30, Math.floor(ttlSeconds))
    );
  } catch {
    // ignore cache errors
  }
}

export async function isFreshNoPoolCache(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<boolean> {
  const key = getNoPoolCacheKey(chainId, tokenIn, tokenOut);
  const hit = noPoolNegativeCache.get(key);
  if (!hit) return false;
  if (!isFresh(hit.timestamp, ttlMs)) {
    noPoolNegativeCache.delete(key);
    return false;
  }
  const remote = await cacheGet(noPoolRedisKey(chainId, tokenIn, tokenOut)).catch(() => null);
  if (remote) return true;
  return true;
}

export function setNoPoolCache(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  reason: string,
  ttlMs: number
): void {
  const key = getNoPoolCacheKey(chainId, tokenIn, tokenOut);
  noPoolNegativeCache.set(key, { reason, timestamp: Date.now() });
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  cacheSet(noPoolRedisKey(chainId, tokenIn, tokenOut), reason || '1', ttlSeconds).catch(() => { });
}

export function clearNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): void {
  noPoolNegativeCache.delete(getNoPoolCacheKey(chainId, tokenIn, tokenOut));
  cacheDel(noPoolRedisKey(chainId, tokenIn, tokenOut)).catch(() => { });
}

export async function getSharedExternalReferenceQuote(
  cacheKey: string,
  ttlMs: number
): Promise<ExternalReferenceQuoteSnapshot | null> {
  const local = sharedExternalReferenceQuoteCache.get(cacheKey);
  if (local && isFresh(local.timestamp, ttlMs)) {
    return local.value;
  }
  if (local) {
    sharedExternalReferenceQuoteCache.delete(cacheKey);
  }

  try {
    const raw = await cacheGet(sharedExternalReferenceQuoteRedisKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      ref0x?: string;
      best?: string;
      timestamp?: number;
    };
    if (!parsed?.timestamp || !isFresh(parsed.timestamp, ttlMs)) {
      return null;
    }
    const value: ExternalReferenceQuoteSnapshot = {
      ref0x: BigInt(parsed.ref0x || '0'),
      best: BigInt(parsed.best || '0')
    };
    sharedExternalReferenceQuoteCache.set(cacheKey, { value, timestamp: parsed.timestamp });
    return value;
  } catch {
    return null;
  }
}

export async function setSharedExternalReferenceQuote(
  cacheKey: string,
  snapshot: ExternalReferenceQuoteSnapshot,
  ttlSeconds: number
): Promise<void> {
  const timestamp = Date.now();
  sharedExternalReferenceQuoteCache.set(cacheKey, { value: snapshot, timestamp });
  try {
    await cacheSet(
      sharedExternalReferenceQuoteRedisKey(cacheKey),
      JSON.stringify({
        ref0x: snapshot.ref0x.toString(),
        best: snapshot.best.toString(),
        timestamp
      }),
      Math.max(1, Math.floor(ttlSeconds))
    );
  } catch {
    // ignore cache errors
  }
}

export async function withInflightSingleflight<T>(
  inflightMap: Map<string, Promise<T>>,
  key: string,
  loader: () => Promise<T>
): Promise<{ value: T; shared: boolean }> {
  const inflight = inflightMap.get(key);
  if (inflight) {
    return { value: await inflight, shared: true };
  }

  const task = loader().finally(() => {
    inflightMap.delete(key);
  });
  inflightMap.set(key, task);
  return { value: await task, shared: false };
}
