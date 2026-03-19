import { LogCode } from '../../../../config/logRegistry.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapHint, HintedSourcePool } from '../../directSwapTypes.js';
import type { DirectSwapResult } from '../types.js';
import { dedupeResolvedHints, type ResolvedPoolHint, type TurboResolver } from '../turbo.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
import type { OrderRuntimeContext } from '../../../order-runtime/types.js';
import {
  buildTurboRescueOrder,
  buildTurboSinglePoolAttemptPlan,
  isLikelyAerodromeHintTrustworthy,
  resolvedHintIdentity
} from '../domain/candidatePlan.js';
import { sourcePoolToResolvedHint } from '../turbo.js';
import type { HintLiquidityGateResult } from '../domain/guards.js';
import { evaluateSourceAnchorQuote, resolveSourceAnchorExpectation } from '../domain/guards.js';
import { summarizeTurboCandidateKinds } from './turboFlow.js';
import { applyTurboQuoteAssist } from './turboQuoteAssist.js';
import { buildResolvedHintQuoteKey } from '../quote/types.js';
import {
  buildTimedOutDirectSwapAttempt,
  shouldHaltFurtherDirectSwapAttempts
} from './directSwapAttemptGuard.js';

type LoggerLike = {
  info: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
  warn: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
};

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
  runtimeContext?: OrderRuntimeContext;
};

type WithTimeoutFn = <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;

type TurboRescueBypassDecision = {
  skip: boolean;
  reason: string;
  failureCode: string;
};

type SourceAnchorLike = NonNullable<ReturnType<typeof resolveSourceAnchorExpectation>>;

function computeTurboDirectAttemptTimeoutMs(params: {
  turboFastDeadline: number;
  phaseDeadline: number;
  hintPoolTimeoutMs: number;
}): number {
  const remainingFastMs = params.turboFastDeadline - Date.now();
  const remainingPhaseMs = params.phaseDeadline - Date.now();
  return Math.max(
    120,
    Math.min(
      params.hintPoolTimeoutMs,
      remainingFastMs,
      remainingPhaseMs
    )
  );
}

function shouldDemoteFailedSourceHint(error?: string): boolean {
  const lower = String(error || '').toLowerCase();
  if (!lower) return false;
  return (
    lower.includes('pool_pair_mismatch')
    || lower.includes('hint_fast_path_timeout')
    || lower.includes('hint_pool_tokens_unavailable')
    || lower.includes('hint_fastpath_disallowed')
  );
}

function buildV4CandidatePool(candidate: ResolvedPoolHint): SelectedV4Pool | null {
  if (candidate.kind !== 'v4' || !candidate.poolAddress || !candidate.v4PoolKey) return null;
  return {
    poolId: candidate.poolAddress,
    poolAddress: candidate.poolAddress,
    poolKey: {
      currency0: candidate.v4PoolKey.currency0,
      currency1: candidate.v4PoolKey.currency1,
      hooks: candidate.v4PoolKey.hooks,
      fee: candidate.v4PoolKey.fee,
      tickSpacing: candidate.v4PoolKey.tickSpacing
    },
    token0: candidate.v4PoolKey.currency0,
    token1: candidate.v4PoolKey.currency1,
    sqrtPriceX96: '0',
    liquidity: '0',
    fee: candidate.v4PoolKey.fee,
    version: 'v4',
    dex: 'uniswap'
  };
}

function poolToResolvedHint(pool: PoolInfo): ResolvedPoolHint | null {
  const version = String(pool.version || '').toLowerCase();
  if (!pool.poolAddress) return null;
  if (version === 'v4') {
    if (!pool.v4PoolKey) return null;
    return {
      kind: 'v4',
      dex: 'uniswap',
      poolAddress: pool.poolAddress,
      fee: pool.v4PoolKey.fee,
      v4PoolKey: {
        currency0: pool.v4PoolKey.currency0,
        currency1: pool.v4PoolKey.currency1,
        hooks: pool.v4PoolKey.hooks,
        poolManager: '',
        fee: pool.v4PoolKey.fee,
        tickSpacing: pool.v4PoolKey.tickSpacing
      }
    };
  }
  if (version === 'v3') {
    return {
      kind: 'v3',
      dex: (pool.dex === 'pancake' ? 'pancake' : 'uniswap'),
      poolAddress: pool.poolAddress,
      fee: Number(pool.fee || 0)
    };
  }
  if (version === 'v2') {
    return {
      kind: 'v2',
      dex: (pool.dex === 'pancake' ? 'pancake' : 'uniswap'),
      poolAddress: pool.poolAddress,
      fee: Number(pool.fee || 0)
    };
  }
  if (version === 'aerodrome') {
    return {
      kind: 'aerodrome',
      dex: 'aerodrome',
      poolAddress: pool.poolAddress,
      fee: Number(pool.fee || 0)
    };
  }
  return null;
}

export async function runTurboCorrectFlow(params: {
  chainId: number;
  traceId: string;
  swapStart: number;
  turboFastDeadline: number;
  turboSinglePoolPhaseMs: number;
  hintPoolTimeoutMs: number;
  skipCandidateGateWithHint: boolean;
  buyLiqMultiplier: number;
  normalizedTokenIn: string;
  poolTokenIn: string;
  poolTokenOut: string;
  amountInWei: bigint;
  hint?: DirectSwapHint;
  earlyHintedPool: HintedSourcePool | null;
  normalizedParams: TurboExecuteParams;
  logger: LoggerLike;
  withTimeout: WithTimeoutFn;
  resolveHintedPoolFromSourceTx: (params: {
    tokenIn: string;
    tokenOut: string;
    chainId: number;
    hint?: DirectSwapHint;
  }) => Promise<HintedSourcePool | null>;
  getCachedSinglePoolWinnerHint: (
    chainId: number,
    tokenIn: string,
    tokenOut: string
  ) => Promise<ResolvedPoolHint | null>;
  singlePoolResolver: TurboResolver;
  isBuySideStableOrNativeIn: (chainId: number, tokenIn: string) => boolean;
  findTokenPools: (
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    options?: { fastScan?: boolean }
  ) => Promise<PoolInfo[]>;
  evaluateResolvedHintFastPathLiquidityGateFromPools: (params: {
    pools: PoolInfo[];
    tokenIn: string;
    amountInWei: bigint;
    resolvedHint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
    multiplier: number;
  }) => HintLiquidityGateResult;
  tryResolvedPoolHintFastPath: (
    params: TurboExecuteParams,
    hint: DirectSwapHint | undefined,
    options?: { executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }
  ) => Promise<DirectSwapResult | null>;
  shouldSkipResolvedHintRetry: (error?: string) => boolean;
  shouldBypassTurboRescueForSinglePoolError: (error?: string) => TurboRescueBypassDecision;
  sourceAnchorMinRatioBps: number;
  sourceAnchorMaxRatioBps?: number;
  wrappedNativeAddress: string;
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
  getAerodromeExpectedOutput: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    walletAddress: string
  ) => Promise<bigint>;
  getV2ExpectedOutput: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
  ) => Promise<bigint>;
  runTurboRescue: (reason: string) => Promise<DirectSwapResult>;
}): Promise<{ result: DirectSwapResult; selectedResolvedHintForCache: ResolvedPoolHint | null }> {
  const {
    chainId,
    traceId,
    swapStart,
    turboFastDeadline,
    turboSinglePoolPhaseMs,
    hintPoolTimeoutMs,
    skipCandidateGateWithHint,
    buyLiqMultiplier,
    normalizedTokenIn,
    poolTokenIn,
    poolTokenOut,
    amountInWei,
    hint,
    normalizedParams,
    logger,
    sourceAnchorMinRatioBps,
    sourceAnchorMaxRatioBps,
    wrappedNativeAddress
  } = params;

  const singlePoolPhaseDeadline = Math.min(
    turboFastDeadline,
    swapStart + Math.max(250, turboSinglePoolPhaseMs)
  );

const sourceAnchor = resolveSourceAnchorExpectation({
    hint,
    tokenIn: normalizedParams.tokenIn,
    tokenOut: normalizedParams.tokenOut,
    amountInWei,
    wrappedNativeAddress,
    minAnchorRatioBps: sourceAnchorMinRatioBps,
    maxAnchorRatioBps: sourceAnchorMaxRatioBps
  });

  let sourceHintCandidate = params.earlyHintedPool;
  if (!sourceHintCandidate && hint?.sourceTxHash) {
    const sourceHintBudgetMs = Math.max(120, Math.min(650, singlePoolPhaseDeadline - Date.now()));
    if (sourceHintBudgetMs > 0) {
      sourceHintCandidate = await params.withTimeout(
        params.resolveHintedPoolFromSourceTx({
          tokenIn: poolTokenIn,
          tokenOut: poolTokenOut,
          chainId,
          hint
        }),
        sourceHintBudgetMs
      ).catch(() => null);
    }
  }

  // Ultra-simple turbo fast path:
  // If we can resolve a single pool directly from tracked source tx,
  // execute it immediately without quote ranking/anchor prechecks.
  let failedSourcePriorityId: string | null = null;
  if (sourceHintCandidate) {
    const sourceResolvedHint = sourcePoolToResolvedHint(sourceHintCandidate);
    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo source-pool immediate direct attempt', {
      chainId,
      traceId,
      kind: sourceResolvedHint.kind,
      dex: sourceResolvedHint.dex || null,
      poolAddress: sourceResolvedHint.poolAddress || null
    });
    const sourceDirectAttemptTimeoutMs = computeTurboDirectAttemptTimeoutMs({
      turboFastDeadline,
      phaseDeadline: singlePoolPhaseDeadline,
      hintPoolTimeoutMs
    });
    const sourceDirectTry: DirectSwapResult | null = await params.withTimeout(
      params.tryResolvedPoolHintFastPath(
        normalizedParams,
        {
          ...(hint || {}),
          canUseResolvedPoolFastPath: true,
          routeHopCount: 1,
          resolvedPoolHint: sourceResolvedHint
        },
        { executionMode: 'turbo', trustedHint: true }
      ),
      sourceDirectAttemptTimeoutMs
    ).catch(
      (): DirectSwapResult => buildTimedOutDirectSwapAttempt({
        runtimeContext: normalizedParams.runtimeContext,
        timeoutError: 'hint_fast_path_timeout'
      })
    );
    if (sourceDirectTry?.success) {
      return {
        result: sourceDirectTry,
        selectedResolvedHintForCache: sourceResolvedHint
      };
    }
    if (shouldHaltFurtherDirectSwapAttempts(sourceDirectTry)) {
      return {
        result: sourceDirectTry || {
          success: false,
          error: 'direct_swap_attempt_halted',
          provider: 'failed'
        },
        selectedResolvedHintForCache: sourceResolvedHint
      };
    }
    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo source-pool immediate attempt failed, fallback to candidate flow', {
      chainId,
      traceId,
      error: sourceDirectTry?.error || 'unknown'
    });
    if (shouldDemoteFailedSourceHint(sourceDirectTry?.error)) {
      failedSourcePriorityId = resolvedHintIdentity(sourceResolvedHint);
    }
  }

  const sourcePriorityCandidate = sourceHintCandidate
    ? sourcePoolToResolvedHint(sourceHintCandidate)
    : null;
  const sourcePriorityId = sourcePriorityCandidate
    ? resolvedHintIdentity(sourcePriorityCandidate)
    : null;

  const cachedSinglePoolHint = await params.getCachedSinglePoolWinnerHint(chainId, poolTokenIn, poolTokenOut);
  let turboCandidates = await params.singlePoolResolver.resolveCandidates({
    chainId,
    tokenIn: poolTokenIn,
    tokenOut: poolTokenOut,
    amountInWei,
    hint,
    sourceHint: sourceHintCandidate,
    cachedWinnerHint: cachedSinglePoolHint,
    deadlineMs: singlePoolPhaseDeadline
  });
  const singlePoolHintPriority = Boolean(
    hint?.sourceTxHash
    || hint?.resolvedPoolHint
    || sourceHintCandidate
    || cachedSinglePoolHint
  );

  if (turboCandidates.length === 0) {
    const turboBackfillMaxMs = Number(process.env.DIRECT_SWAP_TURBO_BACKFILL_TIMEOUT_MS || '2200');
    const discoveryBudgetMs = Math.max(120, Math.min(turboBackfillMaxMs, turboFastDeadline - Date.now()));
    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow fast discovery backfill check', {
      chainId,
      traceId,
      discoveryBudgetMs,
      timeLeftToTurboDeadlineMs: Math.max(0, turboFastDeadline - Date.now())
    });
    if (discoveryBudgetMs > 0) {
      try {
        const discoveredPools = await params.withTimeout(
          params.findTokenPools(poolTokenIn, poolTokenOut, chainId, { fastScan: true }),
          discoveryBudgetMs
        );
        const discoveredCandidates = dedupeResolvedHints(
          discoveredPools
            .sort((a, b) => {
              const vOrder = (version: string | undefined) => {
                const v = String(version || '').toLowerCase();
                if (v === 'v4') return 0;
                if (v === 'v3') return 1;
                if (v === 'aerodrome') return 2;
                if (v === 'v2') return 3;
                return 9;
              };
              const byVersion = vOrder(a.version) - vOrder(b.version);
              if (byVersion !== 0) return byVersion;
              const liqA = BigInt(a.liquidity || '0');
              const liqB = BigInt(b.liquidity || '0');
              if (liqA === liqB) return 0;
              return liqA > liqB ? -1 : 1;
            })
            .map(poolToResolvedHint)
        );
        if (discoveredCandidates.length > 0) {
          turboCandidates = discoveredCandidates;
          logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow candidates backfilled from fast pool discovery', {
            chainId,
            traceId,
            discoveryBudgetMs,
            poolCount: discoveredPools.length,
            candidateCount: turboCandidates.length,
            candidateByKind: summarizeTurboCandidateKinds(turboCandidates)
          });
        } else {
          logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow fast discovery found no candidate', {
            chainId,
            traceId,
            poolCount: discoveredPools.length
          });
        }
      } catch (error: any) {
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow fast discovery backfill failed', {
          chainId,
          traceId,
          error: String(error?.message || error || 'unknown').slice(0, 120)
        });
      }
    }
  }

  logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow candidates resolved', {
    chainId,
    traceId,
    candidateCount: turboCandidates.length,
    candidateByKind: summarizeTurboCandidateKinds(turboCandidates),
    sources: {
      resolvedHint: Boolean(hint?.resolvedPoolHint),
      sourceTxHint: Boolean(sourceHintCandidate),
      cachedHint: Boolean(cachedSinglePoolHint)
    }
  });

  if (failedSourcePriorityId && turboCandidates.length > 1) {
    const before = turboCandidates.length;
    turboCandidates = turboCandidates.filter((candidate) => resolvedHintIdentity(candidate) !== failedSourcePriorityId);
    if (before !== turboCandidates.length) {
      logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow demoted failed source hint candidate', {
        chainId,
        traceId,
        before,
        after: turboCandidates.length,
        failedSourcePriorityId
      });
    }
  }

  if (chainId === 8453) {
    const aeroTrusted = isLikelyAerodromeHintTrustworthy(hint);
    if (!aeroTrusted) {
      const before = turboCandidates.length;
      turboCandidates = turboCandidates.filter((candidate) => candidate.kind !== 'aerodrome');
      if (before !== turboCandidates.length) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow filtered untrusted Aerodrome candidates', {
          traceId,
          chainId,
          before,
          after: turboCandidates.length,
          sourceDex: hint?.sourceDexName || null
        });
      }
    }
  }

  if (params.isBuySideStableOrNativeIn(chainId, normalizedTokenIn) && turboCandidates.length > 0) {
    if (skipCandidateGateWithHint && singlePoolHintPriority) {
      logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow liquidity gate skipped by hint priority', {
        traceId,
        chainId,
        candidateCount: turboCandidates.length
      });
    } else {
      const candidateCountBeforeGate = turboCandidates.length;
      const gateBudgetMs = Math.max(120, Math.min(hintPoolTimeoutMs, singlePoolPhaseDeadline - Date.now()));
      let gatePools: PoolInfo[] = [];
      let gateDiscoveryFailed = false;
      if (gateBudgetMs <= 80) {
        gateDiscoveryFailed = true;
      } else {
        try {
          gatePools = await params.withTimeout(
            params.findTokenPools(poolTokenIn, poolTokenOut, chainId, { fastScan: true }),
            gateBudgetMs
          );
        } catch {
          gateDiscoveryFailed = true;
        }
      }
      if (gateDiscoveryFailed || gatePools.length === 0) {
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow liquidity gate unavailable', {
          traceId,
          chainId,
          gateBudgetMs,
          gateDiscoveryFailed,
          poolCount: gatePools.length,
          candidateCount: turboCandidates.length
        });
      } else {
        const dropped: Array<Record<string, string | number | null>> = [];
        turboCandidates = turboCandidates.filter((candidate) => {
          const gate = params.evaluateResolvedHintFastPathLiquidityGateFromPools({
            pools: gatePools,
            tokenIn: poolTokenIn,
            amountInWei,
            resolvedHint: candidate,
            multiplier: Math.max(1, buyLiqMultiplier)
          });
          const allowUncertain = !gate.allowed && gate.blockType === 'uncertain_block';
          if (!gate.allowed && !allowUncertain) {
            dropped.push({
              kind: candidate.kind,
              dex: candidate.dex || null,
              poolAddress: candidate.poolAddress || null,
              reason: gate.reason,
              blockType: gate.blockType
            });
          }
          return gate.allowed || allowUncertain;
        });
        if (dropped.length > 0) {
          logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow candidates dropped by liquidity gate', {
            traceId,
            chainId,
            droppedCount: dropped.length,
            remaining: turboCandidates.length,
            dropped
          });
        }
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow liquidity gate summary', {
          traceId,
          chainId,
          candidateCountBeforeGate,
          candidateCountAfterGate: turboCandidates.length,
          droppedCount: dropped.length,
          gatePoolCount: gatePools.length
        });
      }
    }
  }

  if (turboCandidates.length === 0) {
    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow candidates empty, entering rescue', {
      traceId,
      chainId
    });
    return {
      result: await params.runTurboRescue('no_valid_candidate_hint'),
      selectedResolvedHintForCache: null
    };
  }

  const turboOrder = buildTurboRescueOrder(chainId);
  let turboAttemptPlan = buildTurboSinglePoolAttemptPlan(turboCandidates, chainId, {
    preferredFirst: sourcePriorityCandidate,
    maxAttempts: 3
  });
  const turboQuoteBudgetMs = turboAttemptPlan.length > 1
    ? Math.max(0, Math.min(Number(process.env.DIRECT_SWAP_TURBO_QUOTE_ASSIST_MS || '220'), singlePoolPhaseDeadline - Date.now() - 25))
    : 0;
  const turboQuoteAssist = await applyTurboQuoteAssist({
    attemptPlan: turboAttemptPlan,
    chainId,
    tokenIn: poolTokenIn,
    tokenOut: poolTokenOut,
    amountInWei,
    slippageBps: normalizedParams.slippageBps,
    walletAddress: normalizedParams.walletAddress,
    hint,
    quoteBudgetMs: turboQuoteBudgetMs,
    withTimeout: params.withTimeout,
    deps: {
      getV4BestPoolQuote: params.getV4BestPoolQuote,
      getV3BestQuoteOut: params.getV3BestQuoteOut,
      getAerodromeExpectedOutput: params.getAerodromeExpectedOutput,
      getV2ExpectedOutput: params.getV2ExpectedOutput
    }
  });
  turboAttemptPlan = turboQuoteAssist.attemptPlan;
  logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow attempt plan', {
    chainId,
    traceId,
    turboOrder: turboOrder.join(' -> '),
    sourcePriority: sourcePriorityId || null,
    quoteAssistApplied: turboQuoteAssist.applied,
    quoteBudgetMs: turboQuoteBudgetMs,
    attempts: turboAttemptPlan.map((candidate, idx) => ({
      idx: idx + 1,
      kind: candidate.kind,
      dex: candidate.dex || null,
      poolAddress: candidate.poolAddress || null,
      sourcePriority: Boolean(sourcePriorityId && resolvedHintIdentity(candidate) === sourcePriorityId),
      quotedOut: turboQuoteAssist.quoteByCandidateKey.get(buildResolvedHintQuoteKey(candidate))?.toString() || null
    }))
  });

  let lastTurboError = 'Turbo single-pool attempt failed';
  let lastTurboProvider: DirectSwapResult['provider'] = 'failed';
  for (let attempt = 0; attempt < turboAttemptPlan.length; attempt++) {
    const routeStartAt = Date.now();
    const candidate = turboAttemptPlan[attempt];
    const isSourcePriorityAttempt = Boolean(sourcePriorityId && resolvedHintIdentity(candidate) === sourcePriorityId);
    const turboHint: DirectSwapHint = {
      ...(hint || {}),
      canUseResolvedPoolFastPath: true,
      routeHopCount: 1,
      resolvedPoolHint: candidate
    };

    const candidateQuotedOut = turboQuoteAssist.quoteByCandidateKey.get(buildResolvedHintQuoteKey(candidate)) || 0n;

    if (sourceAnchor) {
      logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow anchor precheck skipped in fast lane', {
        traceId,
        chainId,
        attempt: attempt + 1,
        kind: candidate.kind,
        isSourcePriorityAttempt
      });
    }

    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow attempt', {
      chainId,
      traceId,
      attempt: attempt + 1,
      turboOrder: turboOrder.join(' -> '),
      kind: candidate.kind,
      dex: candidate.dex || null,
      poolAddress: candidate.poolAddress || null,
      quotedOut: candidateQuotedOut > 0n ? candidateQuotedOut.toString() : null
    });
    const sendStartAt = Date.now();
    const directAttemptTimeoutMs = computeTurboDirectAttemptTimeoutMs({
      turboFastDeadline,
      phaseDeadline: singlePoolPhaseDeadline,
      hintPoolTimeoutMs
    });
    const directTry: DirectSwapResult | null = await params.withTimeout(
      params.tryResolvedPoolHintFastPath(
        normalizedParams,
        turboHint,
        { executionMode: 'turbo', trustedHint: true }
      ),
      directAttemptTimeoutMs
    ).catch(
      (): DirectSwapResult => buildTimedOutDirectSwapAttempt({
        runtimeContext: normalizedParams.runtimeContext,
        timeoutError: 'hint_fast_path_timeout'
      })
    );
    const sendMs = Date.now() - sendStartAt;
    const routeMs = sendStartAt - routeStartAt;
    if (directTry?.provider) {
      lastTurboProvider = directTry.provider;
    }
    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo direct attempt result', {
      traceId,
      chainId,
      attempt: attempt + 1,
      kind: candidate.kind,
      dex: candidate.dex || null,
      poolAddress: candidate.poolAddress || null,
      success: Boolean(directTry?.success),
      provider: directTry?.provider || null,
      txHash: directTry?.txHash || null,
      route_ms: routeMs,
      send_ms: sendMs,
      fallback_used: false,
      fail_reason: directTry?.error || null
    });
    if (directTry?.success) {
      return {
        result: directTry,
        selectedResolvedHintForCache: candidate
      };
    }
    if (shouldHaltFurtherDirectSwapAttempts(directTry)) {
      return {
        result: directTry || {
          success: false,
          error: 'direct_swap_attempt_halted',
          provider: 'failed'
        },
        selectedResolvedHintForCache: candidate
      };
    }
    if (directTry?.error) {
      lastTurboError = directTry.error;
    }
    if (params.shouldSkipResolvedHintRetry(directTry?.error)) {
      break;
    }
  }

  const rescueBypassDecision = params.shouldBypassTurboRescueForSinglePoolError(lastTurboError);
  if (rescueBypassDecision.skip) {
    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow failed with non-route error, skipping rescue', {
      traceId,
      chainId,
      failureCode: rescueBypassDecision.failureCode,
      reason: rescueBypassDecision.reason,
      lastTurboError
    });
    return {
      result: {
        success: false,
        error: lastTurboError,
        provider: lastTurboProvider
      },
      selectedResolvedHintForCache: null
    };
  }

  logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow attempts failed, entering rescue', {
    traceId,
    chainId,
    turboOrder: turboOrder.join(' -> '),
    failureCode: rescueBypassDecision.failureCode,
    lastTurboError
  });
  return {
    result: await params.runTurboRescue(lastTurboError),
    selectedResolvedHintForCache: null
  };
}
