export function resolveDisplayedAmountOut(params: {
  status: 'sending' | 'pending' | 'success' | 'failed' | 'pending_verification';
  currentAmountOut?: string | null;
  settledAmountOut?: string | null;
}): string | null | undefined {
  if (params.status === 'success') {
    if (shouldKeepQuotedDisplayAmount(params.currentAmountOut, params.settledAmountOut)) {
      return params.currentAmountOut;
    }
    return params.settledAmountOut || params.currentAmountOut;
  }
  return params.currentAmountOut;
}

function shouldKeepQuotedDisplayAmount(
  currentAmountOut?: string | null,
  settledAmountOut?: string | null,
): boolean {
  const current = parsePositiveAmount(currentAmountOut);
  if (current === null) return false;

  const settled = parsePositiveAmount(settledAmountOut);
  if (settled === null) return true;

  // Some execution paths report raw base units or a rounded "0.00" while the
  // quote card already has the human-readable amount. Keep the quote when the
  // settled value is clearly less display-safe.
  if (settled === 0) return true;
  const ratio = settled / current;
  return Number.isFinite(ratio) && (ratio > 1_000_000 || ratio < 0.000001);
}

function parsePositiveAmount(value?: string | null): number | null {
  const normalized = String(value || '').trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
