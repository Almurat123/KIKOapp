export interface TokenToTokenExecutionPlanInput {
  tokenToTokenEnabled: boolean;
}

export interface TokenToTokenExecutionPlanResult {
  shouldSellLeg: boolean;
  shouldBuyLeg: boolean;
  reasonCode: 'TOKEN_TO_TOKEN_SELL_ONLY' | 'TOKEN_TO_TOKEN_PARALLEL_BUY_SELL';
}

// For aggregator multi-hop swaps, the sold token should still trigger mirror-sell
// even when the final output asset is another token rather than a cash leg.
export function resolveTokenToTokenExecutionPlan(
  input: TokenToTokenExecutionPlanInput,
): TokenToTokenExecutionPlanResult {
  if (input.tokenToTokenEnabled) {
    return {
      shouldSellLeg: true,
      shouldBuyLeg: true,
      reasonCode: 'TOKEN_TO_TOKEN_PARALLEL_BUY_SELL',
    };
  }

  return {
    shouldSellLeg: true,
    shouldBuyLeg: false,
    reasonCode: 'TOKEN_TO_TOKEN_SELL_ONLY',
  };
}
