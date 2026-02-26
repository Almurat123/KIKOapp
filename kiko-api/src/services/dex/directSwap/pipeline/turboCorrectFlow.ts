import { LogCode } from '../../../../config/logRegistry.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapHint, HintedSourcePool } from '../../directSwapTypes.js';
import type { DirectSwapResult } from '../types.js';
import type { ResolvedPoolHint, TurboResolver } from '../turbo.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
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
};

type WithTimeoutFn = <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;

type TurboRescueBypassDecision = {
  skip: boolean;
  reason: string;
  failureCode: string;
};

type SourceAnchorLike = NonNullable<ReturnType<typeof resolveSourceAnchorExpectation>>;

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
          if (!gate.allowed) {
            dropped.push({
              kind: candidate.kind,
              dex: candidate.dex || null,
              poolAddress: candidate.poolAddress || null,
              reason: gate.reason,
              blockType: gate.blockType
            });
          }
          return gate.allowed;
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
  const turboAttemptPlan = buildTurboSinglePoolAttemptPlan(turboCandidates, chainId, {
    preferredFirst: sourcePriorityCandidate,
    maxAttempts: 3
  });
  logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow attempt plan', {
    chainId,
    traceId,
    turboOrder: turboOrder.join(' -> '),
    sourcePriority: sourcePriorityId || null,
    attempts: turboAttemptPlan.map((candidate, idx) => ({
      idx: idx + 1,
      kind: candidate.kind,
      dex: candidate.dex || null,
      poolAddress: candidate.poolAddress || null,
      sourcePriority: Boolean(sourcePriorityId && resolvedHintIdentity(candidate) === sourcePriorityId)
    }))
  });

  let lastTurboError = 'Turbo single-pool attempt failed';
  let lastTurboProvider: DirectSwapResult['provider'] = 'failed';
  for (let attempt = 0; attempt < turboAttemptPlan.length; attempt++) {
    const candidate = turboAttemptPlan[attempt];
    const isSourcePriorityAttempt = Boolean(sourcePriorityId && resolvedHintIdentity(candidate) === sourcePriorityId);
    const turboHint: DirectSwapHint = {
      ...(hint || {}),
      canUseResolvedPoolFastPath: true,
      routeHopCount: 1,
      resolvedPoolHint: candidate
    };

    const quoteBudgetMs = Math.max(120, Math.min(600, turboFastDeadline - Date.now()));
    let candidateQuotedOut = 0n;
    if (quoteBudgetMs > 0) {
      candidateQuotedOut = await params.withTimeout((async (): Promise<bigint> => {
        if (candidate.kind === 'v4') {
          const hintedPool = buildV4CandidatePool(candidate);
          const v4Quote = await params.getV4BestPoolQuote(
            poolTokenIn,
            poolTokenOut,
            amountInWei,
            chainId,
            normalizedParams.walletAddress,
            turboHint,
            hintedPool
              ? {
                preloadedPools: [{
                  poolId: hintedPool.poolId,
                  poolKey: hintedPool.poolKey,
                  sqrtPriceX96: hintedPool.sqrtPriceX96,
                  tick: 0,
                  liquidity: hintedPool.liquidity,
                  protocolFee: 0,
                  lpFee: hintedPool.poolKey.fee
                }]
              }
              : undefined
          );
          return v4Quote.amountOut;
        }
        if (candidate.kind === 'v3') {
          const dex = candidate.dex === 'pancake' ? 'pancake' : 'uniswap';
          return await params.getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, dex);
        }
        if (candidate.kind === 'aerodrome') {
          return await params.getAerodromeExpectedOutput(
            normalizedParams.tokenIn,
            normalizedParams.tokenOut,
            amountInWei,
            chainId,
            normalizedParams.slippageBps,
            normalizedParams.walletAddress
          );
        }
        return await params.getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
      })(), quoteBudgetMs).catch(() => 0n);
    }

    if (sourceAnchor) {
      if (candidateQuotedOut <= 0n) {
        if (!isSourcePriorityAttempt) {
          lastTurboError = `source_anchor_quote_unavailable:${candidate.kind}`;
          logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow anchor guard skipped candidate (quote unavailable)', {
            traceId,
            chainId,
            attempt: attempt + 1,
            kind: candidate.kind,
            quoteBudgetMs
          });
          continue;
        }
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow source-priority candidate continues without quote precheck', {
          traceId,
          chainId,
          attempt: attempt + 1,
          kind: candidate.kind,
          quoteBudgetMs
        });
      }
      if (candidateQuotedOut > 0n) {
        const anchorCheck = evaluateSourceAnchorQuote(candidateQuotedOut, sourceAnchor as SourceAnchorLike);
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo correct-flow source anchor check', {
          traceId,
          chainId,
          attempt: attempt + 1,
          kind: candidate.kind,
          sourceTxHash: sourceAnchor.sourceTxHash || null,
          quotedOut: candidateQuotedOut.toString(),
          expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
          anchorRatioBps: anchorCheck.ratioBps,
          minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
          maxAnchorRatioBps: sourceAnchor.maxAnchorRatioBps || null,
          anchorAccepted: anchorCheck.accepted
        });
        if (!anchorCheck.accepted) {
          lastTurboError = `source_anchor_guard_reject:${candidate.kind}:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}:${sourceAnchor.maxAnchorRatioBps || 0}`;
          continue;
        }
      }
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
    const directTry = await params.tryResolvedPoolHintFastPath(
      normalizedParams,
      turboHint,
      { executionMode: 'turbo', trustedHint: true }
    );
    if (directTry?.provider) {
      lastTurboProvider = directTry.provider;
    }
    if (directTry?.success) {
      return {
        result: directTry,
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
