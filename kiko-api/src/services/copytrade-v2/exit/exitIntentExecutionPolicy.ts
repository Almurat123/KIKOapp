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
}

export function classifyExitIntentExecutionError(error: unknown): ExitIntentErrorDisposition {
  if (error instanceof ExitHotPathDeferredError) {
    return {
      reasonCode: error.reasonCode,
      sameJobRetry: false,
    };
  }

  const errorCode = String((error as any)?.code || '').trim().toLowerCase();
  const errorMessage = String((error as any)?.message || error || '').trim();
  const lowerMessage = errorMessage.toLowerCase();
  const transient = TRANSIENT_ERROR_PATTERNS.some((pattern) => lowerMessage.includes(pattern))
    || ['econnreset', 'etimedout', 'ehostunreach', 'econnrefused'].includes(errorCode);

  return {
    reasonCode: transient
      ? `transient_network_retry:${errorCode || 'message'}`
      : (errorMessage || 'intent_execution_failed'),
    sameJobRetry: transient,
  };
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
