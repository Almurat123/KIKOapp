import type { DexStrategy, DirectSwapHint } from '../../directSwapTypes.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
import { quoteStrategyEstimate, type QuoteAdapterDeps } from '../quote/adapters.js';
import { rankStrategyQuotes } from '../quote/ranker.js';
import { buildStrategyQuoteKey, isQuoteCapableStrategy } from '../quote/types.js';

export async function prepareNormalQuotedStrategies(params: {
  strategies: DexStrategy[];
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  slippageBps: number;
  walletAddress: string;
  hint?: DirectSwapHint;
  pools: PoolInfo[];
  preloadedV4Pools?: V4PoolInfo[] | null;
  deps: QuoteAdapterDeps;
}): Promise<{
  strategies: DexStrategy[];
  quoteByStrategyKey: Map<string, bigint>;
}> {
  const quoteCapableIndexes = params.strategies
    .map((strategy, index) => ({ strategy, index }))
    .filter((entry) => isQuoteCapableStrategy(entry.strategy));

  if (quoteCapableIndexes.length <= 1) {
    const quoteByStrategyKey = new Map<string, bigint>();
    for (const entry of quoteCapableIndexes) {
      quoteByStrategyKey.set(buildStrategyQuoteKey(entry.strategy), 0n);
    }
    return {
      strategies: params.strategies,
      quoteByStrategyKey
    };
  }

  const quoteEstimates = await Promise.all(
    quoteCapableIndexes.map((entry) =>
      quoteStrategyEstimate(
        entry.strategy,
        {
          chainId: params.chainId,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountInWei: params.amountInWei,
          slippageBps: params.slippageBps,
          walletAddress: params.walletAddress,
          hint: params.hint,
          pools: params.pools,
          preloadedV4Pools: params.preloadedV4Pools
        },
        params.deps
      )
    )
  );

  const ranked = rankStrategyQuotes(quoteEstimates.filter((estimate): estimate is NonNullable<typeof estimate> => Boolean(estimate)));
  if (ranked.length === 0) {
    return {
      strategies: params.strategies,
      quoteByStrategyKey: new Map<string, bigint>()
    };
  }

  const reordered = [...params.strategies];
  quoteCapableIndexes.forEach((entry, idx) => {
    reordered[entry.index] = ranked[idx]?.strategy || entry.strategy;
  });

  return {
    strategies: reordered,
    quoteByStrategyKey: new Map(ranked.map((estimate) => [estimate.key, estimate.quotedOut]))
  };
}
