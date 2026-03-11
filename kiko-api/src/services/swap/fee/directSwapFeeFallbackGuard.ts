type FallbackStatus = 'sending' | 'sent' | 'failed';

type FallbackRow = {
  status: FallbackStatus;
  updatedAt: number;
  feeTxHash?: string;
  lastError?: string;
  attemptCount: number;
};

export type FallbackFeeClaimResult =
  | {
    status: 'claimed';
    reasonCode: 'fee_claim_fallback_new' | 'fee_claim_fallback_retry';
    attemptCount: number;
  }
  | {
    status: 'already_sent';
    reasonCode: 'fee_already_sent';
    feeTxHash?: string;
  }
  | {
    status: 'inflight';
    reasonCode: 'fee_inflight_active';
  };

const FALLBACK_INFLIGHT_TTL_MS = Math.max(5_000, Number(process.env.DIRECT_SWAP_FEE_FALLBACK_INFLIGHT_TTL_MS || '15000'));
const FALLBACK_SENT_TTL_MS = Math.max(FALLBACK_INFLIGHT_TTL_MS, Number(process.env.DIRECT_SWAP_FEE_FALLBACK_SENT_TTL_MS || '45000'));
const fallbackRows = new Map<string, FallbackRow>();

function now(): number {
  return Date.now();
}

function pruneExpiredRows(): void {
  const ts = now();
  for (const [key, row] of fallbackRows.entries()) {
    const maxAge = row.status === 'sent' ? FALLBACK_SENT_TTL_MS : FALLBACK_INFLIGHT_TTL_MS;
    if (ts - row.updatedAt > maxAge) {
      fallbackRows.delete(key);
    }
  }
}

export function buildDirectSwapFeeFallbackExecutionKey(params: {
  userId: string;
  chainId: number;
  mode: string;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  amountIn: string;
  amountOutBase?: string;
  feeToken: string;
  feeRecipient: string;
  feeBps: number;
}): string {
  return [
    String(params.chainId),
    String(params.mode || '').trim().toLowerCase(),
    String(params.userId || '').trim().toLowerCase(),
    String(params.normalizedTokenIn || '').trim().toLowerCase(),
    String(params.normalizedTokenOut || '').trim().toLowerCase(),
    String(params.amountIn || '').trim().toLowerCase(),
    String(params.amountOutBase || '').trim().toLowerCase() || 'na',
    String(params.feeToken || '').trim().toLowerCase(),
    String(params.feeRecipient || '').trim().toLowerCase(),
    String(Math.max(0, Math.floor(Number(params.feeBps) || 0))),
  ].join(':');
}

export function claimDirectSwapFeeFallbackExecution(feeExecutionKey: string): FallbackFeeClaimResult {
  pruneExpiredRows();
  const normalizedKey = String(feeExecutionKey || '').trim().toLowerCase();
  if (!normalizedKey) {
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_active',
    };
  }

  const existing = fallbackRows.get(normalizedKey);
  if (!existing) {
    fallbackRows.set(normalizedKey, {
      status: 'sending',
      updatedAt: now(),
      attemptCount: 1,
    });
    return {
      status: 'claimed',
      reasonCode: 'fee_claim_fallback_new',
      attemptCount: 1,
    };
  }

  if (existing.status === 'sent') {
    return {
      status: 'already_sent',
      reasonCode: 'fee_already_sent',
      feeTxHash: existing.feeTxHash,
    };
  }

  if (existing.status === 'sending') {
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_active',
    };
  }

  const nextAttempt = existing.attemptCount + 1;
  fallbackRows.set(normalizedKey, {
    status: 'sending',
    updatedAt: now(),
    attemptCount: nextAttempt,
  });
  return {
    status: 'claimed',
    reasonCode: 'fee_claim_fallback_retry',
    attemptCount: nextAttempt,
  };
}

export function markDirectSwapFeeFallbackExecutionSent(params: {
  feeExecutionKey: string;
  feeTxHash: string;
}): void {
  const normalizedKey = String(params.feeExecutionKey || '').trim().toLowerCase();
  if (!normalizedKey) return;
  const existing = fallbackRows.get(normalizedKey);
  fallbackRows.set(normalizedKey, {
    status: 'sent',
    updatedAt: now(),
    attemptCount: existing?.attemptCount || 1,
    feeTxHash: String(params.feeTxHash || '').trim().toLowerCase() || undefined,
  });
}

export function markDirectSwapFeeFallbackExecutionFailed(params: {
  feeExecutionKey: string;
  error: string;
}): void {
  const normalizedKey = String(params.feeExecutionKey || '').trim().toLowerCase();
  if (!normalizedKey) return;
  const existing = fallbackRows.get(normalizedKey);
  fallbackRows.set(normalizedKey, {
    status: 'failed',
    updatedAt: now(),
    attemptCount: existing?.attemptCount || 1,
    lastError: String(params.error || '').trim() || undefined,
  });
}

export function resetDirectSwapFeeFallbackExecutionState(): void {
  fallbackRows.clear();
}
