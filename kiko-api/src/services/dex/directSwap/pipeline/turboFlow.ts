import { LogCode } from '../../../../config/logRegistry.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
import type { DirectSwapHint } from '../../directSwapTypes.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { DirectSwapResult, DirectSwapTraceState } from '../types.js';

export function summarizeTurboCandidateKinds(candidates: Array<{ kind: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of candidates) {
    const key = String(c.kind || 'unknown');
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export function hasTurboBudget(deadlineMs: number, nowMs: number, minRemainMs: number = 80): boolean {
  return (deadlineMs - nowMs) > minRemainMs;
}

function fallbackV4TickSpacing(fee?: number): number {
  switch (Number(fee || 0)) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    case 50000: return 1000;
    default: return 60;
  }
}

type TurboExecuteParams = {
  userId: string;
  accessToken: string;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInWei: bigint;
  chainId: number;
  slippageBps: number;
  mevProtection?: boolean;
};

type LoggerLike = {
  info: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
  warn: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
};

type TurboRescueDeps = {
  logger: LoggerLike;
  withTimeout: <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;
  findTokenPools: (
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    options?: { fastScan?: boolean }
  ) => Promise<PoolInfo[]>;
  summarizePools: (pools: PoolInfo[]) => { poolsFound: number; poolKinds: { v2: number; v3: number; v4: number } };
  buildTurboRescueOrder: (chainId: number) => Array<'v4' | 'v3' | 'v2' | 'aerodrome'>;
  resolveSourceAnchorExpectation: (params: {
    hint?: DirectSwapHint;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    wrappedNativeAddress: string;
    minAnchorRatioBps: number;
    maxAnchorRatioBps?: number;
  }) => {
    sourceTxHash?: string;
    expectedOutFromSource: bigint;
    minAnchorRatioBps: number;
    maxAnchorRatioBps?: number;
  } | null;
  evaluateSourceAnchorQuote: (quotedOut: bigint, sourceAnchor: {
    sourceTxHash?: string;
    expectedOutFromSource: bigint;
    minAnchorRatioBps: number;
  }) => {
    accepted: boolean;
    ratioBps: number;
  };
  evaluateBuyLiquidityProtection: (
    pools: PoolInfo[],
    tokenIn: string,
    amountInWei: bigint,
    multiplier: number
  ) => {
    eligible: boolean;
    requiredReserveInWei: bigint;
    checkedPools: number;
    matchedPools: number;
    byVersion: Record<string, number>;
    sample: Array<Record<string, unknown>>;
  };
  poolPassesRequiredReserve: (pool: PoolInfo, tokenIn: string, requiredReserveInWei: bigint) => boolean;
  capTurboRescueCandidatePools: (
    pools: PoolInfo[],
    order: Array<'v4' | 'v3' | 'v2' | 'aerodrome'>,
    maxPerKind: number,
    maxTotal: number
  ) => PoolInfo[];
  isV4SwapSupported: (chainId: number) => boolean;
  isBuySideStableOrNativeIn: (chainId: number, tokenIn: string) => boolean;
  getV4BestPoolQuote: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    walletAddress: string,
    hint?: DirectSwapHint,
    options?: { preloadedPools?: V4PoolInfo[] }
  ) => Promise<{ pool: SelectedV4Pool | null; amountOut: bigint }>;
  getV3BestQuoteOut: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake'
  ) => Promise<bigint>;
  getV2ExpectedOutput: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
  ) => Promise<bigint>;
  getAerodromeExpectedOutput: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    walletAddress: string
  ) => Promise<bigint>;
  pickBestPool: (
    pools: PoolInfo[],
    version: 'v2' | 'v3' | 'v4' | 'aerodrome',
    chainId: number,
    dex?: 'uniswap' | 'pancake' | 'aerodrome'
  ) => Promise<PoolInfo | null>;
  executeV4Swap: (
    params: TurboExecuteParams,
    pool: SelectedV4Pool,
    options?: { allowZeroQuoteMinOut?: boolean; fastMode?: boolean; executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }
  ) => Promise<DirectSwapResult>;
  executeV3Swap: (
    params: TurboExecuteParams,
    pool: PoolInfo,
    dex: 'uniswap' | 'pancake',
    options?: { fastMode?: boolean; executionMode?: 'safe' | 'normal' | 'turbo' }
  ) => Promise<DirectSwapResult>;
  executeV2Swap: (params: TurboExecuteParams, expectedOut: bigint) => Promise<DirectSwapResult>;
  executeAerodromeSwap: (params: TurboExecuteParams) => Promise<DirectSwapResult>;
  classifyFailure: (error: string) => string;
};

export async function runTurboRescueFlow(params: {
  reason: string;
  chainId: number;
  traceId: string;
  swapStart: number;
  turboFastDeadline: number;
  directSwapFastpathBudgetMs: number;
  directSwapHintPoolTimeoutMs: number;
  directSwapTurboPoolDiscoveryTimeoutMs: number;
  directSwapBuyLiqMultiplier: number;
  turboRescueMaxCandidatesPerKind: number;
  turboRescueMaxTotalCandidates: number;
  sourceAnchorMinRatioBps: number;
  sourceAnchorMaxRatioBps?: number;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  poolTokenIn: string;
  poolTokenOut: string;
  amountInWei: bigint;
  hint?: DirectSwapHint;
  walletAddress: string;
  slippageBps: number;
  normalizedParams: TurboExecuteParams;
  wrappedNativeAddress: string;
  traceState: DirectSwapTraceState;
  deps: TurboRescueDeps;
}): Promise<DirectSwapResult> {
  const {
    reason,
    chainId,
    traceId,
    swapStart,
    turboFastDeadline,
    directSwapFastpathBudgetMs,
    directSwapHintPoolTimeoutMs,
    directSwapTurboPoolDiscoveryTimeoutMs,
    directSwapBuyLiqMultiplier,
    turboRescueMaxCandidatesPerKind,
    turboRescueMaxTotalCandidates,
    sourceAnchorMinRatioBps,
    sourceAnchorMaxRatioBps,
    normalizedTokenIn,
    normalizedTokenOut,
    poolTokenIn,
    poolTokenOut,
    amountInWei,
    hint,
    walletAddress,
    slippageBps,
    normalizedParams,
    wrappedNativeAddress,
    traceState,
    deps
  } = params;

  const rescueOrder = deps.buildTurboRescueOrder(chainId);
  const sourceAnchor = deps.resolveSourceAnchorExpectation({
    hint,
    tokenIn: normalizedParams.tokenIn,
    tokenOut: normalizedParams.tokenOut,
    amountInWei,
    wrappedNativeAddress,
    minAnchorRatioBps: sourceAnchorMinRatioBps,
    maxAnchorRatioBps: sourceAnchorMaxRatioBps
  });

  const hasSourceHint = Boolean(hint?.sourceTxHash || hint?.resolvedPoolHint);
  const rescueDeadlineMs = hasSourceHint
    ? turboFastDeadline
    : (turboFastDeadline + directSwapTurboPoolDiscoveryTimeoutMs);
  const remainingBudgetMs = rescueDeadlineMs - Date.now();
  if (remainingBudgetMs <= 80) {
    deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue skipped: budget exhausted', {
      traceId,
      chainId,
      reason,
      turboOrder: rescueOrder.join(' -> '),
      elapsedMs: Date.now() - swapStart,
      budgetMs: directSwapFastpathBudgetMs,
      turboFastDeadline,
      rescueDeadlineMs,
      hasSourceHint
    });
    return { success: false, error: `turbo_rescue_budget_exhausted:${reason}`, provider: 'failed' };
  }

  const baseRescuePoolBudgetMs = hasSourceHint
    ? directSwapHintPoolTimeoutMs
    : directSwapTurboPoolDiscoveryTimeoutMs;
  const rescuePoolBudgetMs = Math.max(180, Math.min(baseRescuePoolBudgetMs, remainingBudgetMs));
  let rescuePools: PoolInfo[] = [];
  let rescuePoolDiscoveryFailed = false;
  try {
    rescuePools = await deps.withTimeout(
      deps.findTokenPools(poolTokenIn, poolTokenOut, chainId, { fastScan: true }),
      rescuePoolBudgetMs
    );
  } catch {
    rescuePoolDiscoveryFailed = true;
    rescuePools = [];
  }

  const rescueSummary = deps.summarizePools(rescuePools);
  traceState.poolCount = rescueSummary.poolsFound;
  traceState.poolKinds = rescueSummary.poolKinds;
  traceState.l1PoolStatus = rescuePools.length > 0 ? 'ok' : 'missing';
  deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue pool discovery', {
    traceId,
    chainId,
    reason,
    poolCount: rescuePools.length,
    poolKinds: rescueSummary.poolKinds,
    poolDiscoveryFailed: rescuePoolDiscoveryFailed,
    timeoutMs: rescuePoolBudgetMs,
    baseBudgetMs: baseRescuePoolBudgetMs,
    hasSourceHint
  });

  if (rescuePoolDiscoveryFailed) {
    return { success: false, error: `turbo_rescue_exhausted:pool_discovery_failed:${reason}`, provider: 'failed' };
  }
  if (rescuePools.length === 0) {
    return { success: false, error: `turbo_rescue_exhausted:no_pools_after:${reason}`, provider: 'failed' };
  }

  let candidatePools = rescuePools;
  if (deps.isBuySideStableOrNativeIn(chainId, normalizedTokenIn)) {
    const guard = deps.evaluateBuyLiquidityProtection(
      rescuePools,
      poolTokenIn,
      amountInWei,
      Math.max(1, directSwapBuyLiqMultiplier)
    );
    deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue liquidity guard', {
      traceId,
      chainId,
      algorithm: 'buy_liquidity_multiplier',
      multiplier: directSwapBuyLiqMultiplier,
      requiredReserveInWei: guard.requiredReserveInWei.toString().slice(0, 20),
      checkedPools: guard.checkedPools,
      matchedPools: guard.matchedPools,
      byVersion: guard.byVersion,
      sample: guard.sample
    });
    candidatePools = rescuePools.filter((pool) => {
      return deps.poolPassesRequiredReserve(pool, poolTokenIn, guard.requiredReserveInWei);
    });
    if (candidatePools.length === 0) {
      deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue liquidity guard reject-all', {
        traceId,
        chainId,
        reason
      });
      return { success: false, error: `liquidity_guard_reject_all:${reason}`, provider: 'failed' };
    }
  }

  const candidatePoolsBeforeCap = candidatePools.length;
  candidatePools = deps.capTurboRescueCandidatePools(
    candidatePools,
    rescueOrder,
    turboRescueMaxCandidatesPerKind,
    turboRescueMaxTotalCandidates
  );
  let lastRescueError = `turbo_rescue_start:${reason}`;

  deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue strategy order', {
    traceId,
    chainId,
    turboOrder: rescueOrder.join(' -> '),
    candidatePoolsBeforeCap,
    candidatePools: candidatePools.length,
    candidateByKind: {
      v4: candidatePools.filter((pool) => pool.version === 'v4').length,
      v3: candidatePools.filter((pool) => pool.version === 'v3').length,
      v2: candidatePools.filter((pool) => pool.version === 'v2').length,
      aerodrome: candidatePools.filter((pool) => String(pool.version || '').toLowerCase() === 'aerodrome').length
    },
    maxPerKind: turboRescueMaxCandidatesPerKind,
    maxTotal: turboRescueMaxTotalCandidates
  });

  if (deps.isV4SwapSupported(chainId)) {
    deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
      traceId,
      chainId,
      strategyKind: 'v4'
    });

    const rescueV4Pools = candidatePools
      .filter((p) => p.version === 'v4')
      .map((p) => ({
        poolId: p.poolAddress,
        poolKey: {
          currency0: p.v4PoolKey?.currency0 || p.token0,
          currency1: p.v4PoolKey?.currency1 || p.token1,
          hooks: p.v4PoolKey?.hooks || '0x0000000000000000000000000000000000000000',
          fee: p.v4PoolKey?.fee ?? p.fee ?? 3000,
          tickSpacing: p.v4PoolKey?.tickSpacing ?? fallbackV4TickSpacing(p.fee)
        },
        sqrtPriceX96: p.sqrtPriceX96 || '0',
        tick: 0,
        liquidity: p.liquidity || '0',
        protocolFee: 0,
        lpFee: p.fee ?? 3000
      })) satisfies V4PoolInfo[];

    if (rescueV4Pools.length > 0) {
      const v4BudgetMs = Math.max(120, Math.min(700, rescueDeadlineMs - Date.now()));
      if (v4BudgetMs > 0) {
        const v4Best = await deps.withTimeout(
          deps.getV4BestPoolQuote(
            poolTokenIn,
            poolTokenOut,
            amountInWei,
            chainId,
            walletAddress,
            hint,
            { preloadedPools: rescueV4Pools }
          ),
          v4BudgetMs
        ).catch(() => ({ pool: null, amountOut: 0n } as { pool: SelectedV4Pool | null; amountOut: bigint }));

        if (v4Best.pool && v4Best.amountOut > 0n) {
          let anchorRejected = false;
          if (sourceAnchor) {
            const anchorCheck = deps.evaluateSourceAnchorQuote(v4Best.amountOut, sourceAnchor);
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
              traceId,
              chainId,
              strategyKind: 'v4',
              sourceTxHash: sourceAnchor.sourceTxHash || null,
              quotedOut: v4Best.amountOut.toString(),
              expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
              anchorRatioBps: anchorCheck.ratioBps,
              minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
              maxAnchorRatioBps: sourceAnchor.maxAnchorRatioBps || null,
              anchorAccepted: anchorCheck.accepted
            });
            if (!anchorCheck.accepted) {
              lastRescueError = `source_anchor_guard_reject:v4:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}:${sourceAnchor.maxAnchorRatioBps || 0}`;
              anchorRejected = true;
            }
          }
          if (anchorRejected) {
            deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
              traceId,
              chainId,
              strategyKind: 'v4',
              skipReason: 'source_anchor_guard_reject'
            });
          } else {
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
              traceId,
              chainId,
              strategyKind: 'v4',
              selectedKind: 'v4',
              poolId: v4Best.pool.poolAddress,
              amountOut: v4Best.amountOut.toString()
            });
            const v4Result = await deps.executeV4Swap(normalizedParams, v4Best.pool, {
              fastMode: true,
              executionMode: 'turbo'
            });
            if (v4Result.success) return v4Result;
            lastRescueError = v4Result.error || 'turbo_rescue_v4_failed';
            deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
              traceId,
              chainId,
              strategyKind: 'v4',
              failureCode: deps.classifyFailure(lastRescueError),
              error: lastRescueError
            });
          }
        }
      }
    }
  }

  const v3DexOrder: Array<'uniswap' | 'pancake'> = chainId === 56
    ? ['pancake', 'uniswap']
    : ['uniswap', 'pancake'];
  deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
    traceId,
    chainId,
    strategyKind: 'v3',
    v3DexOrder
  });

  for (const dex of v3DexOrder) {
    const v3Pool = await deps.pickBestPool(candidatePools, 'v3', chainId, dex);
    if (!v3Pool) continue;

    const v3QuoteBudgetMs = Math.max(120, Math.min(650, rescueDeadlineMs - Date.now()));
    if (v3QuoteBudgetMs <= 0) break;

    const v3Quote = await deps.withTimeout(
      deps.getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, dex),
      v3QuoteBudgetMs
    ).catch(() => 0n);
    if (v3Quote <= 0n) continue;

    if (sourceAnchor) {
      const anchorCheck = deps.evaluateSourceAnchorQuote(v3Quote, sourceAnchor);
      deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
        traceId,
        chainId,
        strategyKind: 'v3',
        dex,
        sourceTxHash: sourceAnchor.sourceTxHash || null,
        quotedOut: v3Quote.toString(),
        expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
        anchorRatioBps: anchorCheck.ratioBps,
        minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
        maxAnchorRatioBps: sourceAnchor.maxAnchorRatioBps || null,
        anchorAccepted: anchorCheck.accepted
      });
      if (!anchorCheck.accepted) {
        lastRescueError = `source_anchor_guard_reject:v3:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}:${sourceAnchor.maxAnchorRatioBps || 0}`;
        continue;
      }
    }

    deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
      traceId,
      chainId,
      strategyKind: 'v3',
      selectedKind: 'v3',
      dex,
      pool: v3Pool.poolAddress,
      amountOut: v3Quote.toString()
    });

    const v3Result = await deps.executeV3Swap(normalizedParams, v3Pool, dex, {
      fastMode: true,
      executionMode: 'turbo'
    });
    if (v3Result.success) return v3Result;

    lastRescueError = v3Result.error || `turbo_rescue_v3_${dex}_failed`;
    deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
      traceId,
      chainId,
      strategyKind: 'v3',
      dex,
      failureCode: deps.classifyFailure(lastRescueError),
      error: lastRescueError
    });
  }

  if (rescueOrder.includes('aerodrome')) {
    const aeroPool = await deps.pickBestPool(candidatePools, 'aerodrome', chainId);
    if (aeroPool) {
      const aeroQuoteBudgetMs = Math.max(120, Math.min(650, rescueDeadlineMs - Date.now()));
      if (aeroQuoteBudgetMs > 0) {
        const aeroQuote = await deps.withTimeout(
          deps.getAerodromeExpectedOutput(
            normalizedTokenIn,
            normalizedTokenOut,
            amountInWei,
            chainId,
            slippageBps,
            walletAddress
          ),
          aeroQuoteBudgetMs
        ).catch(() => 0n);

        if (aeroQuote > 0n) {
          let anchorRejected = false;
          if (sourceAnchor) {
            const anchorCheck = deps.evaluateSourceAnchorQuote(aeroQuote, sourceAnchor);
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
              traceId,
              chainId,
              strategyKind: 'aerodrome',
              sourceTxHash: sourceAnchor.sourceTxHash || null,
              quotedOut: aeroQuote.toString(),
              expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
              anchorRatioBps: anchorCheck.ratioBps,
              minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
              maxAnchorRatioBps: sourceAnchor.maxAnchorRatioBps || null,
              anchorAccepted: anchorCheck.accepted
            });
            if (!anchorCheck.accepted) {
              lastRescueError = `source_anchor_guard_reject:aerodrome:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}:${sourceAnchor.maxAnchorRatioBps || 0}`;
              anchorRejected = true;
            }
          }

          if (anchorRejected) {
            deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
              traceId,
              chainId,
              strategyKind: 'aerodrome',
              skipReason: 'source_anchor_guard_reject'
            });
          } else {
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
              traceId,
              chainId,
              strategyKind: 'aerodrome',
              selectedKind: 'aerodrome',
              pool: aeroPool.poolAddress,
              amountOut: aeroQuote.toString()
            });
            const aeroResult = await deps.executeAerodromeSwap(normalizedParams);
            if (aeroResult.success) return aeroResult;
            lastRescueError = aeroResult.error || 'turbo_rescue_aerodrome_failed';
          }
        } else {
          deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome quote unavailable', {
            traceId,
            chainId,
            strategyKind: 'aerodrome',
            pool: aeroPool.poolAddress,
            amountOut: aeroQuote.toString(),
            quoteBudgetMs: aeroQuoteBudgetMs
          });
        }
      } else {
        deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome skipped: budget exhausted', {
          traceId,
          chainId,
          strategyKind: 'aerodrome',
          pool: aeroPool.poolAddress,
          quoteBudgetMs: aeroQuoteBudgetMs
        });
      }
    } else {
      deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome skipped: no pool candidate', {
        traceId,
        chainId
      });
    }
  }

  if (rescueOrder.includes('v2')) {
    deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
      traceId,
      chainId,
      strategyKind: 'v2'
    });
    const v2Pool = await deps.pickBestPool(candidatePools, 'v2', chainId);
    if (v2Pool) {
      const v2QuoteBudgetMs = Math.max(120, Math.min(650, rescueDeadlineMs - Date.now()));
      if (v2QuoteBudgetMs > 0) {
        const v2Quote = await deps.withTimeout(
          deps.getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId),
          v2QuoteBudgetMs
        ).catch(() => 0n);
        if (v2Quote > 0n) {
          let anchorRejected = false;
          if (sourceAnchor) {
            const anchorCheck = deps.evaluateSourceAnchorQuote(v2Quote, sourceAnchor);
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
              traceId,
              chainId,
              strategyKind: 'v2',
              sourceTxHash: sourceAnchor.sourceTxHash || null,
              quotedOut: v2Quote.toString(),
              expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
              anchorRatioBps: anchorCheck.ratioBps,
              minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
              maxAnchorRatioBps: sourceAnchor.maxAnchorRatioBps || null,
              anchorAccepted: anchorCheck.accepted
            });
            if (!anchorCheck.accepted) {
              lastRescueError = `source_anchor_guard_reject:v2:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}:${sourceAnchor.maxAnchorRatioBps || 0}`;
              anchorRejected = true;
            }
          }
          if (anchorRejected) {
            deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
              traceId,
              chainId,
              strategyKind: 'v2',
              skipReason: 'source_anchor_guard_reject'
            });
          } else {
            deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
              traceId,
              chainId,
              strategyKind: 'v2',
              selectedKind: 'v2',
              pool: v2Pool.poolAddress,
              amountOut: v2Quote.toString()
            });
            const v2Result = await deps.executeV2Swap(normalizedParams, v2Quote);
            if (v2Result.success) return v2Result;
            lastRescueError = v2Result.error || 'turbo_rescue_v2_failed';
            deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
              traceId,
              chainId,
              strategyKind: 'v2',
              failureCode: deps.classifyFailure(lastRescueError),
              error: lastRescueError
            });
          }
        } else {
          deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
            traceId,
            chainId,
            strategyKind: 'v2',
            skipReason: 'v2_quote_unavailable',
            quoteBudgetMs: v2QuoteBudgetMs
          });
        }
      } else {
        deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
          traceId,
          chainId,
          strategyKind: 'v2',
          skipReason: 'budget_exhausted',
          quoteBudgetMs: v2QuoteBudgetMs
        });
      }
    } else {
      deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
        traceId,
        chainId,
        strategyKind: 'v2',
        skipReason: 'no_pool_candidate'
      });
    }
  }

  return {
    success: false,
    error: `turbo_rescue_exhausted:${lastRescueError}`,
    provider: 'failed'
  };
}
