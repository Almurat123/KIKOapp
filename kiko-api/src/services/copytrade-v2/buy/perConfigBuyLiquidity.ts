import type { DecodedSwap } from '../../txDecoder.js';
import type { LiquidityGuardSnapshot } from '../guards/liquidityGuard.js';

type ResolveBuyLiquidityGuardSnapshot = (
  tokenAddress: string,
  chainId: number,
  tokenInfo: Record<string, any>,
  options?: {
    swap?: DecodedSwap;
    stopAtLiquidityUsd?: number;
    allowTokenInfoFallback?: boolean;
  }
) => Promise<LiquidityGuardSnapshot>;

// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Mira Chen
// Reason: Copytrade buy hot-path refactor found that turbo-only buys still paid for
// shared liquidity scans, and importing this helper in tests eagerly initialized
// the broader runtime through the default liquidity guard import.
// Goal: Keep liquidity snapshots available for guarded modes while letting turbo-only
// buy dispatch avoid pre-send liquidity RPC/quote scans and avoid module-load side effects.
// Owns: Per-config liquidity snapshot preparation and the explicit skip snapshot used
// by turbo-only hot-path admission.
// Does Not Own: Deciding execution mode, target-value admission, token metadata
// fetching, or downstream swap execution.
// Design Language:
// - Guarded modes may enrich liquidity synchronously before admission.
// - Turbo-only batches must not block buy send on liquidity discovery.
// - Default heavy owners should be lazy-loaded; importing this helper must not boot runtime services.
// - Forbidden local patch patterns: hiding liquidity RPC scans inside a helper that
//   callers believe is a no-op for turbo-only execution.
// Document Provenance:
// - Source: system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - Kind: repo doc
// - Retrieved: 2026-04-14
// - Applied To: moving non-essential preparation out of the buy critical path
// - Verification: verified in code design review
// See also:
// - system-journal/INDEX.md
// - system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md
// - system-journal/owner-map/copytrade-webhook-ingress.md
// - system-journal/fix-log/2026-04-14-copytrade-buy-config-index-and-shared-warmup-decoupling.md
// - system-journal/fix-log/2026-04-14-copytrade-turbo-preparation-skip.md

type PerConfigBuyLiquidityDeps = {
  resolveBuyLiquidityGuardSnapshot: ResolveBuyLiquidityGuardSnapshot;
};

export type PreparedPerConfigBuyLiquidity<T> = {
  sharedTokenInfo: T;
  sharedLiquidityGuardSnapshot: LiquidityGuardSnapshot;
  tokenInfoByConfigId: Map<string, T>;
  liquidityGuardSnapshotByConfigId: Map<string, LiquidityGuardSnapshot>;
};

export function applyPreparedTokenInfoPatch<T extends Record<string, any>>(
  prepared: PreparedPerConfigBuyLiquidity<T>,
  patch: Partial<T>
): void {
  if (!patch || Object.keys(patch).length === 0) return;
  Object.assign(prepared.sharedTokenInfo, patch);
  for (const tokenInfo of prepared.tokenInfoByConfigId.values()) {
    if (!tokenInfo || tokenInfo === prepared.sharedTokenInfo) continue;
    Object.assign(tokenInfo, patch);
  }
}

function normalizeLiquidityThreshold(config: any): number {
  const value = Number(config?.minLiquidityUsd || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildSkippedLiquiditySnapshot(reason: string): LiquidityGuardSnapshot {
  return {
    liquidityUsd: 0,
    source: 'unavailable',
    reliable: false,
    poolCount: 0,
    fallbackUsed: false,
    metadata: {
      mode: reason,
    },
  };
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
  skipLiquidityScan?: boolean;
}, deps?: PerConfigBuyLiquidityDeps): Promise<PreparedPerConfigBuyLiquidity<T>> {
  let resolveSnapshot = deps?.resolveBuyLiquidityGuardSnapshot;
  const getResolveSnapshot = async (): Promise<ResolveBuyLiquidityGuardSnapshot> => {
    if (!resolveSnapshot) {
      resolveSnapshot = (await import('../guards/liquidityGuard.js')).resolveBuyLiquidityGuardSnapshot;
    }
    return resolveSnapshot;
  };
  const sharedLiquidityGuardSnapshot = params.skipLiquidityScan
    ? buildSkippedLiquiditySnapshot('turbo_skip_liquidity_scan')
    : await (await getResolveSnapshot())(
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
      promise = getResolveSnapshot().then((resolve) => resolve(
        params.tokenToBuy,
        params.chainId,
        params.tokenInfo,
        {
          swap: params.swap,
          stopAtLiquidityUsd: threshold,
          allowTokenInfoFallback: params.allowTokenInfoFallback,
        }
      )).then((snapshot) => ({
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
      !params.skipLiquidityScan &&
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
