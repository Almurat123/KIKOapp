import type { DexStrategy } from '../../directSwapTypes.js';
import {
  clearNoPoolCache as clearNoPoolCacheInCache,
  getCachedSinglePoolWinnerHint as getCachedSinglePoolWinnerHintFromCache,
  getCachedV4GasLimit as getCachedV4GasLimitFromCache,
  getCachedWinningStrategy as getCachedWinningStrategyFromCache,
  isFreshNoPoolCache as isFreshNoPoolCacheFromCache,
  setCachedSinglePoolWinnerHint as setCachedSinglePoolWinnerHintInCache,
  setCachedV4GasLimit as setCachedV4GasLimitInCache,
  setCachedWinningStrategy as setCachedWinningStrategyInCache,
  setNoPoolCache as setNoPoolCacheInCache
} from '../cache.js';
import type { ResolvedPoolHint } from '../turbo.js';

export function getCachedV4GasLimit(key: string, ttlMs: number): string | null {
  return getCachedV4GasLimitFromCache(key, ttlMs);
}

export function setCachedV4GasLimit(key: string, gasLimit: string): void {
  setCachedV4GasLimitInCache(key, gasLimit);
}

export async function getCachedWinningStrategy(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<DexStrategy | null> {
  return await getCachedWinningStrategyFromCache(chainId, tokenIn, tokenOut, ttlMs);
}

export async function setCachedWinningStrategy(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  strategy: DexStrategy,
  ttlSec: number
): Promise<void> {
  await setCachedWinningStrategyInCache(chainId, tokenIn, tokenOut, strategy, ttlSec);
}

export async function getCachedSinglePoolWinnerHint(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<ResolvedPoolHint | null> {
  const value = await getCachedSinglePoolWinnerHintFromCache(chainId, tokenIn, tokenOut, ttlMs);
  return value as ResolvedPoolHint | null;
}

export async function setCachedSinglePoolWinnerHint(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  hint: ResolvedPoolHint,
  ttlSec: number
): Promise<void> {
  await setCachedSinglePoolWinnerHintInCache(
    chainId,
    tokenIn,
    tokenOut,
    hint as any,
    ttlSec
  );
}

export async function isFreshNoPoolCache(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  ttlMs: number
): Promise<boolean> {
  return await isFreshNoPoolCacheFromCache(chainId, tokenIn, tokenOut, ttlMs);
}

export function setNoPoolCache(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  reason: string,
  ttlMs: number
): void {
  setNoPoolCacheInCache(chainId, tokenIn, tokenOut, reason, ttlMs);
}

export function clearNoPoolCache(
  chainId: number,
  tokenIn: string,
  tokenOut: string
): void {
  clearNoPoolCacheInCache(chainId, tokenIn, tokenOut);
}
