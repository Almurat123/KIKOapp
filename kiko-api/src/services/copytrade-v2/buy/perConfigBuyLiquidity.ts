import type { DecodedSwap } from '../../txDecoder.js';
import {
  resolveBuyLiquidityGuardSnapshot,
  type LiquidityGuardSnapshot,
} from '../guards/liquidityGuard.js';

type PerConfigBuyLiquidityDeps = {
  resolveBuyLiquidityGuardSnapshot: typeof resolveBuyLiquidityGuardSnapshot;
};

export type PreparedPerConfigBuyLiquidity<T> = {
  sharedTokenInfo: T;
  sharedLiquidityGuardSnapshot: LiquidityGuardSnapshot;
  tokenInfoByConfigId: Map<string, T>;
  liquidityGuardSnapshotByConfigId: Map<string, LiquidityGuardSnapshot>;
};

function normalizeLiquidityThreshold(config: any): number {
  const value = Number(config?.minLiquidityUsd || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function applyBuyLiquidityGuardSnapshot<T extends Record<string, any>>(
  tokenInfo: T,
  snapshot: LiquidityGuardSnapshot
): T {
  const next = {
    ...tokenInfo,
    guardLiquidityUsd: snapshot.liquidityUsd,
    guardLiquiditySource: snapshot.source,
    guardLiquidityReliable: snapshot.reliable,
    guardLiquidityPoolCount: snapshot.poolCount,
    guardLiquidityMeta: snapshot.metadata || null,
  } as T;
  if (snapshot.liquidityUsd > 0) {
    (next as Record<string, any>).liquidity = snapshot.liquidityUsd;
  }
  return next;
}

export async function preparePerConfigBuyLiquidity<T extends Record<string, any>>(params: {
  tokenToBuy: string;
  chainId: number;
  swap: DecodedSwap;
  tokenInfo: T;
  configs: any[];
  allowTokenInfoFallback?: boolean;
}, deps: PerConfigBuyLiquidityDeps = {
  resolveBuyLiquidityGuardSnapshot,
}): Promise<PreparedPerConfigBuyLiquidity<T>> {
  const sharedLiquidityGuardSnapshot = await deps.resolveBuyLiquidityGuardSnapshot(
    params.tokenToBuy,
    params.chainId,
    params.tokenInfo,
    {
      swap: params.swap,
      stopAtLiquidityUsd: 0,
      allowTokenInfoFallback: params.allowTokenInfoFallback,
    }
  );
  const sharedTokenInfo = applyBuyLiquidityGuardSnapshot(params.tokenInfo, sharedLiquidityGuardSnapshot);
  const tokenInfoByConfigId = new Map<string, T>();
  const liquidityGuardSnapshotByConfigId = new Map<string, LiquidityGuardSnapshot>();
  const escalatedByThreshold = new Map<number, Promise<{ tokenInfo: T; snapshot: LiquidityGuardSnapshot }>>();
  const sharedLiquidityUsd = Number(sharedLiquidityGuardSnapshot.liquidityUsd || 0);
  const sharedReliable = Boolean(sharedLiquidityGuardSnapshot.reliable);

  const resolveEscalated = (threshold: number) => {
    let promise = escalatedByThreshold.get(threshold);
    if (!promise) {
      promise = deps.resolveBuyLiquidityGuardSnapshot(
        params.tokenToBuy,
        params.chainId,
        params.tokenInfo,
        {
          swap: params.swap,
          stopAtLiquidityUsd: threshold,
          allowTokenInfoFallback: params.allowTokenInfoFallback,
        }
      ).then((snapshot) => ({
        snapshot,
        tokenInfo: applyBuyLiquidityGuardSnapshot(params.tokenInfo, snapshot),
      }));
      escalatedByThreshold.set(threshold, promise);
    }
    return promise;
  };

  for (const config of params.configs) {
    const configId = String(config?.id || '');
    if (!configId) continue;
    const threshold = normalizeLiquidityThreshold(config);
    const needsEscalation =
      threshold > 0 && (sharedLiquidityUsd < threshold || (!sharedReliable && sharedLiquidityUsd <= 0));
    if (!needsEscalation) {
      tokenInfoByConfigId.set(configId, sharedTokenInfo);
      liquidityGuardSnapshotByConfigId.set(configId, sharedLiquidityGuardSnapshot);
      continue;
    }
    const escalated = await resolveEscalated(threshold);
    tokenInfoByConfigId.set(configId, escalated.tokenInfo);
    liquidityGuardSnapshotByConfigId.set(configId, escalated.snapshot);
  }

  return {
    sharedTokenInfo,
    sharedLiquidityGuardSnapshot,
    tokenInfoByConfigId,
    liquidityGuardSnapshotByConfigId,
  };
}
