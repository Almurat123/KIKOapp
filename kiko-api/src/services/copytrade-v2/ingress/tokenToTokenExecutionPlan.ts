export interface TokenToTokenExecutionPlanInput {
  tokenToTokenEnabled: boolean;
  explicitTokenSwap: boolean;
}

export interface TokenToTokenExecutionPlanResult {
  shouldSellLeg: boolean;
  shouldBuyLeg: boolean;
  reasonCode:
    | 'TOKEN_TO_TOKEN_SKIPPED_AMBIGUOUS'
    | 'TOKEN_TO_TOKEN_SKIPPED_DISABLED'
    | 'TOKEN_TO_TOKEN_PARALLEL_BUY_SELL';
}

// Production-grade fallback:
// - ambiguous token-to-token routes should never partially execute
// - explicit token swaps may run both legs only when the policy is enabled
export function resolveTokenToTokenExecutionPlan(
  input: TokenToTokenExecutionPlanInput,
): TokenToTokenExecutionPlanResult {
  if (!input.explicitTokenSwap) {
    return {
      shouldSellLeg: false,
      shouldBuyLeg: false,
      reasonCode: 'TOKEN_TO_TOKEN_SKIPPED_AMBIGUOUS',
    };
  }

  if (input.tokenToTokenEnabled) {
    return {
      shouldSellLeg: true,
      shouldBuyLeg: true,
      reasonCode: 'TOKEN_TO_TOKEN_PARALLEL_BUY_SELL',
    };
  }

  return {
    shouldSellLeg: false,
    shouldBuyLeg: false,
    reasonCode: 'TOKEN_TO_TOKEN_SKIPPED_DISABLED',
  };
}
