export interface CopytradeExecutionFailureDecision {
  retryable: boolean;
  reasonCode: 'trading_execution_failed' | 'failed_terminal';
  hint?: string;
}

export function classifyTradingError(error: unknown): CopytradeExecutionFailureDecision {
  const message = String((error as any)?.message || error || 'unknown_error').toLowerCase();

  if (
    message.includes('timeout')
    || message.includes('rpc')
    || message.includes('network')
    || message.includes('rate limit')
    || message.includes('temporarily')
    || message.includes('nonce')
  ) {
    return {
      retryable: true,
      reasonCode: 'trading_execution_failed',
      hint: 'network_or_nonce',
    };
  }

  if (message.includes('slippage') || message.includes('price impact') || message.includes('revert')) {
    return {
      retryable: false,
      reasonCode: 'failed_terminal',
      hint: 'pricing_or_revert',
    };
  }

  if (
    message.includes('copytrade_fallback_guard_reject')
    || message.includes('quote_anchor_guard_reject')
  ) {
    return {
      retryable: false,
      reasonCode: 'failed_terminal',
      hint: 'guard_reject',
    };
  }

  if (message.includes('insufficient') || message.includes('allowance') || message.includes('approval')) {
    return {
      retryable: false,
      reasonCode: 'failed_terminal',
      hint: 'balance_or_allowance',
    };
  }

  return {
    retryable: true,
    reasonCode: 'trading_execution_failed',
    hint: 'unknown',
  };
}
