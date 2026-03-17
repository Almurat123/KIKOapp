import { ExitHotPathDeferredError } from './exitHotPathPolicy.js';

const SAME_JOB_TRANSIENT_RETRY_DELAYS_MS = [
  Math.max(100, Number(process.env.COPYTRADE_EXIT_INTENT_TRANSIENT_RETRY_1_MS || '300')),
  Math.max(200, Number(process.env.COPYTRADE_EXIT_INTENT_TRANSIENT_RETRY_2_MS || '800')),
  Math.max(300, Number(process.env.COPYTRADE_EXIT_INTENT_TRANSIENT_RETRY_3_MS || '1500')),
] as const;

const TRANSIENT_ERROR_PATTERNS = [
  'network failure',
  'fetch failed',
  'failed to fetch',
  'timeout',
  'timed out',
  'socket hang up',
  'econnreset',
  'etimedout',
  'ehostunreach',
  'econnrefused',
  'gateway timeout',
  'bad gateway',
  'service unavailable',
  'temporarily unavailable',
  'rate limit',
  'too many requests',
  '429',
  'connection reset',
];

export interface ExitIntentErrorDisposition {
  reasonCode: string;
  sameJobRetry: boolean;
  queueRetryAllowed: boolean;
  archivePosition: boolean;
}

export function classifyExitIntentExecutionError(error: unknown): ExitIntentErrorDisposition {
  if (error instanceof ExitHotPathDeferredError) {
    return {
      reasonCode: error.reasonCode,
      sameJobRetry: false,
      queueRetryAllowed: true,
      archivePosition: false,
    };
  }

  const errorCode = String((error as any)?.code || '').trim().toLowerCase();
  const errorMessage = String((error as any)?.message || error || '').trim();
  const lowerMessage = errorMessage.toLowerCase();
  const transient = TRANSIENT_ERROR_PATTERNS.some((pattern) => lowerMessage.includes(pattern))
    || ['econnreset', 'etimedout', 'ehostunreach', 'econnrefused'].includes(errorCode);
  const forbiddenAssetReason = [
    'forbidden_asset_stablecoin',
    'forbidden_asset_native_like',
    'forbidden_asset_wrapped_native',
  ].find((reasonCode) => lowerMessage.includes(reasonCode));
  if (forbiddenAssetReason) {
    return {
      reasonCode: forbiddenAssetReason,
      sameJobRetry: false,
      queueRetryAllowed: false,
      archivePosition: true,
    };
  }

  if (
    lowerMessage.includes('insufficient funds for gas')
    || lowerMessage.includes('insufficient balance')
    || lowerMessage.includes('insufficient_balance')
    || lowerMessage.includes('exit_blocked_insufficient_gas')
  ) {
    return {
      reasonCode: 'exit_blocked_insufficient_gas',
      sameJobRetry: false,
      queueRetryAllowed: false,
      archivePosition: true,
    };
  }

  if (
    lowerMessage.includes('exit_blocked_uneconomic')
    || lowerMessage.includes('expectedout <= gas floor')
    || lowerMessage.includes('expected_out <= gas floor')
    || lowerMessage.includes('uneconomic')
  ) {
    return {
      reasonCode: 'exit_blocked_uneconomic',
      sameJobRetry: false,
      queueRetryAllowed: false,
      archivePosition: true,
    };
  }

  if (lowerMessage.includes('allowance') || lowerMessage.includes('approval')) {
    return {
      reasonCode: 'exit_blocked_allowance',
      sameJobRetry: false,
      queueRetryAllowed: false,
      archivePosition: false,
    };
  }

  return {
    reasonCode: transient
      ? `transient_network_retry:${errorCode || 'message'}`
      : (errorMessage || 'intent_execution_failed'),
    sameJobRetry: transient,
    queueRetryAllowed: transient,
    archivePosition: false,
  };
}

export function isTerminalExitBlockReason(reasonCode: string | null | undefined): boolean {
  const normalized = String(reasonCode || '').trim().toLowerCase();
  return normalized === 'exit_blocked_insufficient_gas'
    || normalized === 'exit_blocked_uneconomic'
    || normalized === 'forbidden_asset_stablecoin'
    || normalized === 'forbidden_asset_native_like'
    || normalized === 'forbidden_asset_wrapped_native';
}

export function resolveSameJobRetryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(SAME_JOB_TRANSIENT_RETRY_DELAYS_MS.length - 1, attempt - 1));
  return SAME_JOB_TRANSIENT_RETRY_DELAYS_MS[index];
}

export function getMaxSameJobRetryAttempts(): number {
  return SAME_JOB_TRANSIENT_RETRY_DELAYS_MS.length;
}

export const __testOnly = {
  SAME_JOB_TRANSIENT_RETRY_DELAYS_MS,
};
