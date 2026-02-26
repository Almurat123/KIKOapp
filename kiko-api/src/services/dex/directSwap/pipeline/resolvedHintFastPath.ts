import { ethers } from 'ethers';
import { LogCode } from '../../../../config/logRegistry.js';
import type { DirectSwapHint } from '../../directSwapTypes.js';
import { isLikelyAerodromeHintTrustworthy } from '../domain/candidatePlan.js';
import { evaluateSourceAnchorQuote, resolveSourceAnchorExpectation } from '../domain/guards.js';
import { isSameHintPair, normalizePairTokenForHint } from '../domain/hintPair.js';
import type { DirectSwapResult } from '../types.js';
import { matchV4PoolKeyById } from '../../uniswapV4.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';

const poolTokenInterface = new ethers.Interface([
  'function token0() view returns (address)',
  'function token1() view returns (address)'
]);

interface ExecuteParams {
  userId: string;
  accessToken: string;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInWei: bigint;
  chainId: number;
  slippageBps: number;
}

interface FastPathDeps {
  logger: {
    info: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
    warn: (code: LogCode, message: string, context?: Record<string, unknown>) => void;
  };
  callRpc: <T = any>(
    chainIdOrName: number | string,
    method: string,
    params?: any,
    options?: { strategy?: 'fast' | 'cheap'; importance?: 'normal' | 'critical'; exhaustiveFailover?: boolean }
  ) => Promise<T>;
  executeV2Swap: (params: ExecuteParams, expectedOut: bigint) => Promise<DirectSwapResult>;
  executeV3Swap: (params: ExecuteParams, pool: any, dex: 'uniswap' | 'pancake', options?: { fastMode?: boolean; executionMode?: 'safe' | 'normal' | 'turbo' }) => Promise<DirectSwapResult>;
  executeV4Swap: (params: ExecuteParams, pool: SelectedV4Pool, options?: { allowZeroQuoteMinOut?: boolean; fastMode?: boolean; executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }) => Promise<DirectSwapResult>;
  executeAerodromeSwap: (params: ExecuteParams) => Promise<DirectSwapResult>;
  getV2ExpectedOutput: (tokenIn: string, tokenOut: string, amountInWei: bigint, chainId: number) => Promise<bigint>;
  wrappedNativeByChain: Record<number, string>;
  sourceAnchorMinRatioBps: number;
}

interface ResolvedHintFlowDeps {
  logger: FastPathDeps['logger'];
  tryResolvedPoolHintFastPath: (
    params: ExecuteParams,
    hint: DirectSwapHint | undefined,
    deps: FastPathDeps,
    options?: { executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }
  ) => Promise<DirectSwapResult | null>;
  isHintFastPathEligible: (params: { hint?: DirectSwapHint; turboMode: boolean }) => {
    eligible: boolean;
    reason?: string;
    hopCount: number;
  };
  evaluateResolvedHintFastPathLiquidityGate: (params: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    resolvedHint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
    budgetMs: number;
  }) => Promise<{
    allowed: boolean;
    reason: string;
    blockType: 'none' | 'definitive_block' | 'uncertain_block';
    poolCount: number;
    matchingPoolCount: number;
    matchingEligibleCount: number;
    requiredReserveInWei: string;
  }>;
  isBuySideStableOrNativeIn: (chainId: number, tokenIn: string) => boolean;
  shouldSkipResolvedHintRetry: (error?: string) => boolean;
  isTurboBudgetExceeded: (startedAtMs: number, budgetMs: number) => boolean;
}

export type ResolvedHintFlowResult = {
  result?: DirectSwapResult;
  resolvedHintFastPathSkipped: boolean;
  resolvedHintFastPathFailed: boolean;
  selectedResolvedHintForCache: NonNullable<DirectSwapHint['resolvedPoolHint']> | null;
};

export function getResolvedHintKey(hint?: DirectSwapHint): string {
  const resolved = hint?.resolvedPoolHint;
  if (!resolved) return 'none';
  return [
    String(resolved.kind || 'unknown'),
    String(resolved.dex || 'unknown'),
    String(resolved.poolAddress || 'none').toLowerCase()
  ].join(':');
}

export function isResolvedHintPresent(hint?: DirectSwapHint): boolean {
  return Boolean(hint?.resolvedPoolHint);
}

async function readPoolPairTokens(
  chainId: number,
  poolAddress: string,
  deps: FastPathDeps
): Promise<{ token0: string; token1: string } | null> {
  if (!poolAddress || !/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) return null;
  try {
    const [token0Hex, token1Hex] = await Promise.all([
      deps.callRpc<string>(
        chainId,
        'eth_call',
        [{ to: poolAddress, data: poolTokenInterface.encodeFunctionData('token0', []) }, 'latest'],
        { strategy: 'fast', importance: 'critical' }
      ),
      deps.callRpc<string>(
        chainId,
        'eth_call',
        [{ to: poolAddress, data: poolTokenInterface.encodeFunctionData('token1', []) }, 'latest'],
        { strategy: 'fast', importance: 'critical' }
      )
    ]);
    const token0 = ethers.getAddress(`0x${token0Hex.slice(-40)}`).toLowerCase();
    const token1 = ethers.getAddress(`0x${token1Hex.slice(-40)}`).toLowerCase();
    return { token0, token1 };
  } catch {
    return null;
  }
}

async function validateResolvedHintAgainstSwapPair(params: {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  hint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
  deps: FastPathDeps;
}): Promise<{ ok: boolean; reason?: string; details?: Record<string, string | number | null> }> {
  const { hint } = params;

  if (hint.kind === 'aerodrome') {
    return { ok: true };
  }

  if (hint.kind === 'v4' && hint.v4PoolKey) {
    const pairOk = isSameHintPair(
      params.tokenIn,
      params.tokenOut,
      hint.v4PoolKey.currency0,
      hint.v4PoolKey.currency1,
      params.deps.wrappedNativeByChain[params.chainId]
    );
    return pairOk ? { ok: true } : {
      ok: false,
      reason: 'v4_pair_mismatch',
      details: {
        swapTokenIn: params.tokenIn,
        swapTokenOut: params.tokenOut,
        poolToken0: hint.v4PoolKey.currency0,
        poolToken1: hint.v4PoolKey.currency1,
        poolAddress: hint.poolAddress || null
      }
    };
  }

  if ((hint.kind === 'v3' || hint.kind === 'v2') && hint.poolAddress) {
    const poolTokens = await readPoolPairTokens(params.chainId, hint.poolAddress.toLowerCase(), params.deps);
    if (!poolTokens) {
      return {
        ok: false,
        reason: 'pool_tokens_unavailable',
        details: { poolAddress: hint.poolAddress.toLowerCase() }
      };
    }
    const pairOk = isSameHintPair(
      params.tokenIn,
      params.tokenOut,
      poolTokens.token0,
      poolTokens.token1,
      params.deps.wrappedNativeByChain[params.chainId]
    );
    return pairOk ? { ok: true } : {
      ok: false,
      reason: 'pool_pair_mismatch',
      details: {
        swapTokenIn: params.tokenIn,
        swapTokenOut: params.tokenOut,
        poolToken0: poolTokens.token0,
        poolToken1: poolTokens.token1,
        poolAddress: hint.poolAddress.toLowerCase()
      }
    };
  }

  return { ok: false, reason: 'unsupported_hint_shape' };
}

export async function tryResolvedPoolHintFastPath(
  params: ExecuteParams,
  hint: DirectSwapHint | undefined,
  deps: FastPathDeps,
  options?: { executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }
): Promise<DirectSwapResult | null> {
  const resolved = hint?.resolvedPoolHint;
  if (!resolved) return null;

  const sourceAnchor = resolveSourceAnchorExpectation({
    hint,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountInWei: params.amountInWei,
    wrappedNativeAddress: deps.wrappedNativeByChain[params.chainId] || '',
    minAnchorRatioBps: deps.sourceAnchorMinRatioBps
  });

  const validation = await validateResolvedHintAgainstSwapPair({
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    chainId: params.chainId,
    hint: resolved,
    deps
  });
  if (!validation.ok) {
    deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Skip resolved pool hint: pair validation failed', {
      chainId: params.chainId,
      reason: validation.reason,
      details: validation.details || null
    });
    return {
      success: false,
      error: `hint_pool_pair_mismatch:${validation.reason || 'unknown'}`,
      provider: 'failed'
    };
  }

  if (resolved.kind === 'v4' && resolved.v4PoolKey) {
    let poolKey = {
      currency0: resolved.v4PoolKey.currency0,
      currency1: resolved.v4PoolKey.currency1,
      hooks: resolved.v4PoolKey.hooks,
      fee: resolved.v4PoolKey.fee,
      tickSpacing: resolved.v4PoolKey.tickSpacing
    };

    const pairAligned = isSameHintPair(
      params.tokenIn,
      params.tokenOut,
      poolKey.currency0,
      poolKey.currency1,
      deps.wrappedNativeByChain[params.chainId]
    );
    const isIncomplete = poolKey.hooks === '0x0000000000000000000000000000000000000000' && poolKey.tickSpacing <= 0;
    if ((isIncomplete || !pairAligned) && resolved.poolAddress) {
      const resolvedKey = matchV4PoolKeyById(
        params.chainId,
        resolved.poolAddress,
        normalizePairTokenForHint(params.tokenIn, deps.wrappedNativeByChain[params.chainId]),
        normalizePairTokenForHint(params.tokenOut, deps.wrappedNativeByChain[params.chainId]),
        poolKey.hooks
      );
      if (resolvedKey) {
        poolKey = {
          currency0: resolvedKey.currency0,
          currency1: resolvedKey.currency1,
          hooks: resolvedKey.hooks,
          fee: resolvedKey.fee,
          tickSpacing: resolvedKey.tickSpacing
        };
        deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Recovered V4 pool key from poolId', {
          chainId: params.chainId,
          poolAddress: resolved.poolAddress,
          reason: isIncomplete ? 'incomplete_hint' : 'pair_realign',
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut
        });
      }
    }

    const selectedPool: SelectedV4Pool = {
      poolId: resolved.poolAddress || '',
      poolAddress: resolved.poolAddress || '',
      poolKey,
      sqrtPriceX96: '0',
      fee: poolKey.fee,
      liquidity: '0'
    };
    return await deps.executeV4Swap(params, selectedPool, {
      allowZeroQuoteMinOut: true,
      fastMode: true,
      executionMode: options?.executionMode,
      trustedHint: options?.trustedHint
    });
  }

  if (resolved.kind === 'aerodrome' || resolved.dex === 'aerodrome') {
    if (!isLikelyAerodromeHintTrustworthy(hint)) {
      deps.logger.warn(LogCode.SYS_INFO, '[DirectSwap] Hint fast-path Aerodrome rejected: untrusted source hint', {
        poolAddress: resolved.poolAddress,
        chainId: params.chainId,
        sourceDex: hint?.sourceDexName || null
      });
      return {
        success: false,
        error: 'hint_fastpath_disallowed:aerodrome_untrusted_source',
        provider: 'failed'
      };
    }
    if (params.chainId === 8453 && options?.executionMode === 'turbo') {
      deps.logger.info(LogCode.SYS_INFO, '[DirectSwap] Hint fast-path Aerodrome deferred in Base turbo', {
        poolAddress: resolved.poolAddress,
        chainId: params.chainId,
        reason: 'prefer_v4_v3_v2_before_aero'
      });
      return {
        success: false,
        error: 'hint_fastpath_disallowed:aerodrome_turbo_deferred',
        provider: 'failed'
      };
    }
    return await deps.executeAerodromeSwap(params);
  }

  if ((resolved.kind === 'v3' || resolved.kind === 'v2') && resolved.poolAddress) {
    const pool: any = {
      poolAddress: resolved.poolAddress,
      token0: params.tokenIn,
      token1: params.tokenOut,
      fee: resolved.fee || 0,
      version: resolved.kind,
      dex: resolved.dex === 'pancake' ? 'pancake' : 'uniswap'
    };
    if (resolved.kind === 'v3') {
      const dex = resolved.dex === 'pancake' ? 'pancake' : 'uniswap';
      return await deps.executeV3Swap(params, pool, dex, {
        fastMode: true,
        executionMode: options?.executionMode
      });
    }

    const expectedOut = await deps.getV2ExpectedOutput(params.tokenIn, params.tokenOut, params.amountInWei, params.chainId);
    if (expectedOut <= 0n) {
      return { success: false, error: 'Resolved V2 pool quote unavailable', provider: 'failed' };
    }

    if (sourceAnchor) {
      const anchorCheck = evaluateSourceAnchorQuote(expectedOut, sourceAnchor);
      if (!anchorCheck.accepted) {
        return {
          success: false,
          error: `source_anchor_guard_reject:v2:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`,
          provider: 'failed'
        };
      }
    }
    return await deps.executeV2Swap(params, expectedOut);
  }

  return null;
}

export async function runResolvedHintFastPathFlow(params: {
  swapStart: number;
  chainId: number;
  traceId: string;
  requestedMode: 'safe' | 'normal' | 'turbo';
  turboMode: boolean;
  hint: DirectSwapHint | undefined;
  normalizedTokenIn: string;
  poolTokenIn: string;
  poolTokenOut: string;
  amountInWei: bigint;
  normalizedParams: ExecuteParams;
  turboFastDeadline: number;
  turboFastpathBudgetMs: number;
  hintPoolTimeoutMs: number;
  liquidityMultiplier: number;
  fastPathDeps: FastPathDeps;
  deps: ResolvedHintFlowDeps;
  logCode?: LogCode;
  skipFastPathErrorWhenBudgetExceeded?: boolean;
}): Promise<ResolvedHintFlowResult> {
  const code = params.logCode || LogCode.SYS_INFO;
  let resolvedHintFastPathSkipped = false;
  let resolvedHintFastPathFailed = false;
  let selectedResolvedHintForCache: NonNullable<DirectSwapHint['resolvedPoolHint']> | null = null;

  if (!params.hint?.resolvedPoolHint) {
    return {
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }

  const hintFastPathEligibility = params.deps.isHintFastPathEligible({
    hint: params.hint,
    turboMode: params.turboMode
  });
  if (!hintFastPathEligibility.eligible) {
    resolvedHintFastPathSkipped = true;
    params.deps.logger.warn(code, '[DirectSwap] Resolved pool hint fast-path skipped by route context', {
      chainId: params.chainId,
      canUseResolvedPoolFastPath: params.hint?.canUseResolvedPoolFastPath,
      routeHopCount: hintFastPathEligibility.hopCount,
      turboMode: params.turboMode,
      reason: hintFastPathEligibility.reason || 'unknown'
    });
    return {
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }

  const resolvedHint = params.hint.resolvedPoolHint as NonNullable<DirectSwapHint['resolvedPoolHint']>;
  let liquidityGateBlocked = false;
  if (params.deps.isBuySideStableOrNativeIn(params.chainId, params.normalizedTokenIn)) {
    const turboTrustedHint = params.turboMode && !!params.hint?.sourceTxHash;
    if (turboTrustedHint) {
      params.deps.logger.info(code, '[DirectSwap] Resolved hint liquidity gate skipped - turbo source-tx trusted', {
        chainId: params.chainId,
        traceId: params.traceId,
        kind: resolvedHint.kind,
        dex: resolvedHint.dex || null,
        poolAddress: resolvedHint.poolAddress || null,
        sourceTxHash: params.hint?.sourceTxHash?.slice(0, 14) || null
      });
    } else {
      const gateBudgetMs = params.turboMode
        ? Math.max(180, Math.min(params.hintPoolTimeoutMs, params.turboFastDeadline - Date.now()))
        : Math.min(1200, params.hintPoolTimeoutMs);
      const gate = await params.deps.evaluateResolvedHintFastPathLiquidityGate({
        chainId: params.chainId,
        tokenIn: params.poolTokenIn,
        tokenOut: params.poolTokenOut,
        amountInWei: params.amountInWei,
        resolvedHint,
        budgetMs: gateBudgetMs
      });
      const gateDecision: 'allow' | 'block_definitive' | 'block_uncertain_but_try' = gate.allowed
        ? 'allow'
        : (params.turboMode && gate.blockType === 'uncertain_block')
          ? 'block_uncertain_but_try'
          : 'block_definitive';
      params.deps.logger.info(code, '[DirectSwap] Resolved hint liquidity gate', {
        chainId: params.chainId,
        traceId: params.traceId,
        mode: params.requestedMode,
        kind: resolvedHint.kind,
        dex: resolvedHint.dex || null,
        poolAddress: resolvedHint.poolAddress || null,
        resolvedHintKind: resolvedHint.kind,
        gateAllowed: gate.allowed,
        gateDecision,
        gateReason: gate.reason,
        gateBlockType: gate.blockType,
        gateBudgetMs,
        poolCount: gate.poolCount,
        matchingPoolCount: gate.matchingPoolCount,
        matchingEligibleCount: gate.matchingEligibleCount,
        requiredReserveInWei: gate.requiredReserveInWei.slice(0, 20),
        multiplier: params.liquidityMultiplier
      });

      if (!gate.allowed && !(params.turboMode && gate.blockType === 'uncertain_block')) {
        liquidityGateBlocked = true;
        resolvedHintFastPathSkipped = true;
        params.deps.logger.warn(code, '[DirectSwap] Resolved pool hint fast-path skipped by liquidity gate', {
          chainId: params.chainId,
          traceId: params.traceId,
          gateDecision,
          gateReason: gate.reason,
          gateBlockType: gate.blockType,
          kind: resolvedHint.kind,
          dex: resolvedHint.dex || null,
          poolAddress: resolvedHint.poolAddress || null
        });
      } else if (!gate.allowed && params.turboMode && gate.blockType === 'uncertain_block') {
        params.deps.logger.info(code, '[DirectSwap] Resolved pool hint gate uncertain in turbo - still attempting fast-path', {
          chainId: params.chainId,
          traceId: params.traceId,
          gateReason: gate.reason,
          gateBlockType: gate.blockType,
          kind: resolvedHint.kind,
          dex: resolvedHint.dex || null,
          poolAddress: resolvedHint.poolAddress || null
        });
      }
    }
  }

  if (liquidityGateBlocked) {
    return {
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }

  params.deps.logger.info(code, '[DirectSwap] Fast-path resolved pool hint attempt', {
    chainId: params.chainId,
    kind: resolvedHint.kind,
    dex: resolvedHint.dex,
    poolAddress: resolvedHint.poolAddress
  });

  const directTry = await params.deps.tryResolvedPoolHintFastPath(
    params.normalizedParams,
    params.hint,
    params.fastPathDeps,
    { executionMode: params.requestedMode, trustedHint: params.turboMode }
  );
  if (directTry?.success) {
    if (params.hint?.resolvedPoolHint?.poolAddress) {
      selectedResolvedHintForCache = params.hint.resolvedPoolHint as NonNullable<DirectSwapHint['resolvedPoolHint']>;
    }
    return {
      result: directTry,
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }
  resolvedHintFastPathFailed = Boolean(directTry && !directTry.success);

  if (!params.turboMode) {
    params.deps.logger.info(code, '[DirectSwap] Resolved pool hint unavailable in normal mode, continue discovery', {
      chainId: params.chainId,
      error: directTry?.error
    });
    return {
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }

  if (params.deps.shouldSkipResolvedHintRetry(directTry?.error)) {
    params.deps.logger.warn(code, '[DirectSwap] Fast-path resolved pool hint failed, skip retry for non-retryable hint failure', {
      chainId: params.chainId,
      error: directTry?.error
    });
  } else {
    params.deps.logger.warn(code, '[DirectSwap] Fast-path resolved pool hint failed, retry once', {
      chainId: params.chainId,
      error: directTry?.error
    });
    const retryTry = await params.deps.tryResolvedPoolHintFastPath(
      params.normalizedParams,
      params.hint,
      params.fastPathDeps,
      { executionMode: params.requestedMode, trustedHint: true }
    );
    if (retryTry?.success) {
      if (params.hint?.resolvedPoolHint?.poolAddress) {
        selectedResolvedHintForCache = params.hint.resolvedPoolHint as NonNullable<DirectSwapHint['resolvedPoolHint']>;
      }
      return {
        result: retryTry,
        resolvedHintFastPathSkipped,
        resolvedHintFastPathFailed,
        selectedResolvedHintForCache
      };
    }
    resolvedHintFastPathFailed = resolvedHintFastPathFailed || Boolean(retryTry && !retryTry.success);
  }

  if (params.deps.isTurboBudgetExceeded(params.swapStart, params.turboFastpathBudgetMs)) {
    if (params.skipFastPathErrorWhenBudgetExceeded) {
      return {
        resolvedHintFastPathSkipped,
        resolvedHintFastPathFailed,
        selectedResolvedHintForCache
      };
    }
    return {
      result: {
        success: false,
        error: 'Fast-path budget exceeded after resolved-pool attempts',
        provider: 'failed'
      },
      resolvedHintFastPathSkipped,
      resolvedHintFastPathFailed,
      selectedResolvedHintForCache
    };
  }

  return {
    resolvedHintFastPathSkipped,
    resolvedHintFastPathFailed,
    selectedResolvedHintForCache
  };
}
