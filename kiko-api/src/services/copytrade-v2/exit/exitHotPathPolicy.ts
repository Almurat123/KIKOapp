export class ExitHotPathDeferredError extends Error {
  readonly reasonCode: string;
  readonly retryAfterMs: number;

  constructor(reasonCode: string, retryAfterMs: number) {
    super(reasonCode);
    this.name = 'ExitHotPathDeferredError';
    this.reasonCode = String(reasonCode || 'exit_deferred');
    this.retryAfterMs = Math.max(100, Number(retryAfterMs || 0));
  }
}

export const FAST_EXIT_INTENT_RETRY_MS = Math.max(
  100,
  Number(process.env.COPYTRADE_EXIT_INTENT_FAST_RETRY_MS || '400')
);

export const ORACLE_EXIT_INTENT_RETRY_MS = Math.max(
  FAST_EXIT_INTENT_RETRY_MS,
  Number(process.env.COPYTRADE_EXIT_INTENT_ORACLE_RETRY_MS || '1500')
);

export const STANDARD_EXIT_INTENT_RETRY_MS = Math.max(
  ORACLE_EXIT_INTENT_RETRY_MS,
  Number(process.env.COPYTRADE_EXIT_INTENT_ERROR_RETRY_MS || '5000')
);

export function hasIntentContext(intentContext: Record<string, unknown> | undefined): boolean {
  return String(intentContext?.intentId || '').trim().length > 0;
}

export function resolveExitIntentRetryDelayMs(params: {
  reasonCode?: string | null;
  retryAfterMs?: number | null;
}): number {
  const explicitRetryAfterMs = Number(params.retryAfterMs || 0);
  if (Number.isFinite(explicitRetryAfterMs) && explicitRetryAfterMs > 0) {
    return Math.max(100, Math.floor(explicitRetryAfterMs));
  }

  const reasonCode = String(params.reasonCode || '').toLowerCase();
  if (!reasonCode) return STANDARD_EXIT_INTENT_RETRY_MS;

  if (
    reasonCode.includes('token_exit_lock_contended')
    || reasonCode.includes('intent_inflight_active')
    || reasonCode.includes('intent_cooldown_active')
  ) {
    return FAST_EXIT_INTENT_RETRY_MS;
  }

  if (
    reasonCode.includes('exit_balance_rpc')
    || reasonCode.includes('oracle')
    || reasonCode.includes('solana_balance_rpc')
  ) {
    return ORACLE_EXIT_INTENT_RETRY_MS;
  }

  return STANDARD_EXIT_INTENT_RETRY_MS;
}

export const __testOnly = {
  FAST_EXIT_INTENT_RETRY_MS,
  ORACLE_EXIT_INTENT_RETRY_MS,
  STANDARD_EXIT_INTENT_RETRY_MS,
};
