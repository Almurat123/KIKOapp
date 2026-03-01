import type { DirectSwapHint } from '../../directSwapTypes.js';
import type { V4PoolInfo } from '../../uniswapV4.js';
import type { ResolvedPoolHint } from '../turbo.js';
import { quoteTurboCandidate } from '../quote/adapters.js';
import { rankTurboCandidateQuotes } from '../quote/ranker.js';
import { buildResolvedHintQuoteKey } from '../quote/types.js';

export async function applyTurboQuoteAssist(params: {
  attemptPlan: ResolvedPoolHint[];
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  slippageBps: number;
  walletAddress: string;
  hint?: DirectSwapHint;
  preloadedV4Pools?: V4PoolInfo[] | null;
  quoteBudgetMs: number;
  withTimeout: <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;
  deps: {
    getV4BestPoolQuote: (
      tokenIn: string,
      tokenOut: string,
      amountInWei: bigint,
      chainId: number,
      walletAddress: string,
      hint?: DirectSwapHint,
      options?: { preloadedPools?: V4PoolInfo[] }
    ) => Promise<{ pool: any; amountOut: bigint }>;
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
}): Promise<{
  attemptPlan: ResolvedPoolHint[];
  quoteByCandidateKey: Map<string, bigint>;
  applied: boolean;
}> {
  if (params.attemptPlan.length <= 1 || params.quoteBudgetMs <= 0) {
    return {
      attemptPlan: params.attemptPlan,
      quoteByCandidateKey: new Map(),
      applied: false
    };
  }

  const first = params.attemptPlan[0];
  const rest = params.attemptPlan.slice(1);
  try {
    const quoted = await params.withTimeout(
      Promise.all(
        rest.map((candidate) =>
          quoteTurboCandidate(
            candidate,
            {
              chainId: params.chainId,
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountInWei: params.amountInWei,
              slippageBps: params.slippageBps,
              walletAddress: params.walletAddress,
              hint: params.hint,
              preloadedV4Pools: params.preloadedV4Pools
            },
            params.deps
          )
        )
      ),
      params.quoteBudgetMs
    );

    const ranked = rankTurboCandidateQuotes(quoted);
    return {
      attemptPlan: [first, ...ranked.map((entry) => entry.candidate)],
      quoteByCandidateKey: new Map([
        [buildResolvedHintQuoteKey(first), 0n],
        ...ranked.map((entry) => [entry.key, entry.quotedOut] as const)
      ]),
      applied: true
    };
  } catch {
    return {
      attemptPlan: params.attemptPlan,
      quoteByCandidateKey: new Map(),
      applied: false
    };
  }
}
