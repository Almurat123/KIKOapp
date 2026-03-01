import type { DexFamily, DexStrategy, DirectSwapHint } from '../../directSwapTypes.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
import type { ResolvedPoolHint } from '../turbo.js';
import {
  buildResolvedHintQuoteKey,
  buildStrategyQuoteKey,
  isQuoteCapableStrategy,
  type StrategyQuoteEstimate,
  type TurboCandidateQuote
} from './types.js';

export type PickBestPoolFn = (
  pools: PoolInfo[],
  version: PoolInfo['version'],
  chainId: number,
  dex?: DexFamily
) => Promise<PoolInfo | null>;

export type QuoteAdapterDeps = {
  pickBestPool: PickBestPoolFn;
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
};

export type QuoteAdapterContext = {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  slippageBps: number;
  walletAddress: string;
  hint?: DirectSwapHint;
  pools: PoolInfo[];
  preloadedV4Pools?: V4PoolInfo[] | null;
};

export async function quoteStrategyEstimate(
  strategy: DexStrategy,
  context: QuoteAdapterContext,
  deps: QuoteAdapterDeps
): Promise<StrategyQuoteEstimate | null> {
  if (!isQuoteCapableStrategy(strategy)) return null;
  const key = buildStrategyQuoteKey(strategy);
  const { chainId, tokenIn, tokenOut, amountInWei, slippageBps, walletAddress, hint, pools, preloadedV4Pools } = context;

  if (strategy.kind === 'v4') {
    const hasV4Sources = (preloadedV4Pools?.length || 0) > 0 || !!hint?.resolvedPoolHint || !!hint?.sourceTxHash;
    if (!hasV4Sources) {
      return { key, strategy, quotedOut: 0n, confidence: 'unavailable', pool: null };
    }
    const quoted = await deps.getV4BestPoolQuote(tokenIn, tokenOut, amountInWei, chainId, walletAddress, hint, {
      preloadedPools: preloadedV4Pools || undefined
    });
    return {
      key,
      strategy,
      quotedOut: quoted.amountOut,
      confidence: quoted.amountOut > 0n ? 'quoted' : (quoted.pool ? 'fallback' : 'unavailable'),
      pool: quoted.pool
    };
  }

  if (strategy.kind === 'v3') {
    const dex = strategy.dex === 'pancake' ? 'pancake' : 'uniswap';
    const pool = await deps.pickBestPool(pools, 'v3', chainId, dex);
    if (!pool) return { key, strategy, quotedOut: 0n, confidence: 'unavailable', pool: null };
    const quotedOut = await deps.getV3BestQuoteOut(tokenIn, tokenOut, amountInWei, chainId, dex);
    return {
      key,
      strategy,
      quotedOut,
      confidence: quotedOut > 0n ? 'quoted' : 'unavailable',
      pool
    };
  }

  if (strategy.kind === 'aerodrome') {
    const quotedOut = await deps.getAerodromeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, slippageBps, walletAddress);
    return {
      key,
      strategy,
      quotedOut,
      confidence: quotedOut > 0n ? 'quoted' : 'unavailable',
      pool: null
    };
  }

  const pool = await deps.pickBestPool(pools, 'v2', chainId, strategy.dex);
  if (!pool) return { key, strategy, quotedOut: 0n, confidence: 'unavailable', pool: null };
  const quotedOut = await deps.getV2ExpectedOutput(tokenIn, tokenOut, amountInWei, chainId);
  return {
    key,
    strategy,
    quotedOut,
    confidence: quotedOut > 0n ? 'quoted' : 'unavailable',
    pool
  };
}

export async function quoteTurboCandidate(
  candidate: ResolvedPoolHint,
  context: Omit<QuoteAdapterContext, 'pools' | 'preloadedV4Pools'> & { preloadedV4Pools?: V4PoolInfo[] | null },
  deps: Omit<QuoteAdapterDeps, 'pickBestPool'>
): Promise<TurboCandidateQuote> {
  const key = buildResolvedHintQuoteKey(candidate);
  const hint: DirectSwapHint = {
    ...(context.hint || {}),
    canUseResolvedPoolFastPath: true,
    routeHopCount: 1,
    resolvedPoolHint: candidate
  };

  if (candidate.kind === 'v4') {
    const quoted = await deps.getV4BestPoolQuote(
      context.tokenIn,
      context.tokenOut,
      context.amountInWei,
      context.chainId,
      context.walletAddress,
      hint,
      { preloadedPools: context.preloadedV4Pools || undefined }
    );
    return {
      key,
      candidate,
      quotedOut: quoted.amountOut,
      confidence: quoted.amountOut > 0n ? 'quoted' : (quoted.pool ? 'fallback' : 'unavailable')
    };
  }

  if (candidate.kind === 'v3') {
    const quotedOut = await deps.getV3BestQuoteOut(
      context.tokenIn,
      context.tokenOut,
      context.amountInWei,
      context.chainId,
      candidate.dex === 'pancake' ? 'pancake' : 'uniswap'
    );
    return {
      key,
      candidate,
      quotedOut,
      confidence: quotedOut > 0n ? 'quoted' : 'unavailable'
    };
  }

  if (candidate.kind === 'aerodrome') {
    const quotedOut = await deps.getAerodromeExpectedOutput(
      context.tokenIn,
      context.tokenOut,
      context.amountInWei,
      context.chainId,
      context.slippageBps,
      context.walletAddress
    );
    return {
      key,
      candidate,
      quotedOut,
      confidence: quotedOut > 0n ? 'quoted' : 'unavailable'
    };
  }

  const quotedOut = await deps.getV2ExpectedOutput(
    context.tokenIn,
    context.tokenOut,
    context.amountInWei,
    context.chainId
  );
  return {
    key,
    candidate,
    quotedOut,
    confidence: quotedOut > 0n ? 'quoted' : 'unavailable'
  };
}
