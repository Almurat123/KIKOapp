export function resolveDisplayedAmountOut(params: {
  status: 'sending' | 'pending' | 'success' | 'failed' | 'pending_verification';
  currentAmountOut?: string | null;
  settledAmountOut?: string | null;
}): string | null | undefined {
  if (params.status === 'success') {
    return params.settledAmountOut || params.currentAmountOut;
  }
  return params.currentAmountOut;
}
