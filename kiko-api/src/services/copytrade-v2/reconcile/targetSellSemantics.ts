import { normalizeAddress } from '../../../utils/address.js';

export function matchesSemanticTargetSell(params: {
  txType?: string | null;
  tokenAddress?: string | null;
  tokenInAddress?: string | null;
  targetTokenAddress: string;
}): boolean {
  const targetToken = normalizeAddress(params.targetTokenAddress || '');
  if (!targetToken) return false;

  const txType = String(params.txType || '').toUpperCase();
  if (txType === 'TARGET_SELL') {
    return normalizeAddress(params.tokenAddress || '') === targetToken
      || normalizeAddress(params.tokenInAddress || '') === targetToken;
  }

  if (txType === 'TARGET_TOKEN_SWAP') {
    return normalizeAddress(params.tokenInAddress || '') === targetToken;
  }

  return false;
}
