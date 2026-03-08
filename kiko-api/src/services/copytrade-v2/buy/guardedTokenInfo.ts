import type { DecodedSwap } from '../../txDecoder.js';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import { resolveBuyLiquidityGuardSnapshot } from '../guards/liquidityGuard.js';
import { shouldAllowTokenInfoLiquidityFallbackForCopyTrade } from './directGuardPolicy.js';

export type CopytradeBuyGuardBucket = 'safe' | 'direct';

export function getCopytradeBuyGuardBucket(executionMode: CopyTradeExecutionMode): CopytradeBuyGuardBucket {
  return shouldAllowTokenInfoLiquidityFallbackForCopyTrade(executionMode) ? 'safe' : 'direct';
}

export function partitionConfigsByBuyGuardBucket<T>(
  configs: readonly T[],
  resolveExecutionMode: (config: T) => CopyTradeExecutionMode
): Map<CopytradeBuyGuardBucket, T[]> {
  const groups = new Map<CopytradeBuyGuardBucket, T[]>();
  for (const config of configs) {
    const bucket = getCopytradeBuyGuardBucket(resolveExecutionMode(config));
    const list = groups.get(bucket);
    if (list) {
      list.push(config);
    } else {
      groups.set(bucket, [config]);
    }
  }
  return groups;
}

export async function buildGuardedTokenInfoForConfigs<T extends Record<string, any>>(params: {
  tokenToBuy: string;
  chainId: number;
  swap: DecodedSwap;
  tokenInfo: T;
  configs: any[];
  resolveExecutionMode: (config: any) => CopyTradeExecutionMode;
}): Promise<{
  tokenInfo: T;
  liquidityGuardSnapshot: Awaited<ReturnType<typeof resolveBuyLiquidityGuardSnapshot>>;
  bucket: CopytradeBuyGuardBucket;
}> {
  const bucketGroups = partitionConfigsByBuyGuardBucket(params.configs, params.resolveExecutionMode);
  const bucket = bucketGroups.has('safe') ? 'safe' : 'direct';
  const allowTokenInfoFallback = bucket === 'safe';
  const stopAtLiquidityUsd = params.configs.reduce((max, config) => {
    const next = Number(config?.minLiquidityUsd || 0);
    return Number.isFinite(next) && next > max ? next : max;
  }, 0);

  const liquidityGuardSnapshot = await resolveBuyLiquidityGuardSnapshot(
    params.tokenToBuy,
    params.chainId,
    params.tokenInfo,
    {
      swap: params.swap,
      stopAtLiquidityUsd,
      allowTokenInfoFallback,
    }
  );

  const tokenInfo = {
    ...params.tokenInfo,
    guardLiquidityUsd: liquidityGuardSnapshot.liquidityUsd,
    guardLiquiditySource: liquidityGuardSnapshot.source,
    guardLiquidityReliable: liquidityGuardSnapshot.reliable,
    guardLiquidityPoolCount: liquidityGuardSnapshot.poolCount,
    guardLiquidityMeta: liquidityGuardSnapshot.metadata || null,
  } as T;

  if (liquidityGuardSnapshot.liquidityUsd > 0) {
    (tokenInfo as Record<string, any>).liquidity = liquidityGuardSnapshot.liquidityUsd;
  }

  return {
    tokenInfo,
    liquidityGuardSnapshot,
    bucket,
  };
}
