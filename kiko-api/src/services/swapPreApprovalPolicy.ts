export type SwapModeForPreApproval = 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad';

export function isPostBuyPreApprovalEnabled(
  mode: SwapModeForPreApproval,
  path: 'direct' | 'fallback'
): boolean {
  const globalEnabled = (process.env.SWAP_POST_BUY_PREAPPROVAL_ENABLED || 'false') === 'true';
  const directEnabled = (process.env.SWAP_DIRECT_POST_BUY_PREAPPROVAL_ENABLED || (globalEnabled ? 'true' : 'false')) === 'true';
  const fallbackEnabled = (process.env.SWAP_FALLBACK_POST_BUY_PREAPPROVAL_ENABLED || (globalEnabled ? 'true' : 'false')) === 'true';

  if (mode === 'copytrade') {
    const copytradeEnabled = (process.env.COPYTRADE_POST_BUY_PREAPPROVAL_ENABLED || 'false') === 'true';
    if (!copytradeEnabled) return false;
  }

  return path === 'direct' ? directEnabled : fallbackEnabled;
}
