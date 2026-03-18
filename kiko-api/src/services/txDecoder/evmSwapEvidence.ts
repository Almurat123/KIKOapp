import { hasLikelyTransferSwapEvidence, type TransferLog } from './evmTransferFallback.js';

export const DEX_SIGNATURES = {
  swapExactTokensForTokens: '0x38ed1739',
  swapTokensForExactTokens: '0x8803dbee',
  swapExactETHForTokens: '0x7ff36ab5',
  swapTokensForExactETH: '0x4a25d94a',
  swapExactTokensForETH: '0x18cbafe5',
  swapETHForExactTokens: '0xfb3bdb41',
  exactInputSingle: '0x414bf389',
  exactOutputSingle: '0xdb3e2198',
  exactInput: '0xc04b8d59',
  exactOutput: '0xf28c0498',
  multicall: '0xac9650d8',
  universalExecute: '0x3593564c',
  transformERC20: '0x415565b0',
  sellToUniswap: '0xd9627aa4',
  sellToPancakeSwap: '0xd9627aa4',
  swap: '0x12aa3caf',
  swapGeneric: '0xe21fd0e9',
  rawReplayA: '0xcae6a6b3',
  rawReplayB: '0x0f27c5c1',
  rawReplayC: '0xd1ee211d',
  rawReplayD: '0x2213bc0b',
  rawReplayE: '0x784e2685',
  rawReplayF: '0x0490a7f3',
  swapExactInput: '0xb80c2f09',
  swapExactTokensForTokensSupportingFeeOnTransferTokens: '0x5c11d795',
  swapExactETHForTokensSupportingFeeOnTransferTokens: '0xb6f9de95',
  swapExactTokensForETHSupportingFeeOnTransferTokens: '0x791ac947',
  exactInputSingleV3Alt: '0x04e45aaf',
  exactInputV3Alt: '0xb858183f',
  exactOutputSingleV3Alt: '0x5023b4df',
  exactOutputV3Alt: '0x09b81346',
  aeroRouteA: '0x0ddd588d',
  aeroRouteB: '0xcac88ea9',
  aeroRouteC: '0x95435ac9',
  aeroRouteD: '0x24856bc3',
  aeroRouteE: '0xc6b7f1b6',
  aeroRouteF: '0x7129bae2',
  aeroRouteG: '0x903638a4',
  aeroRouteH: '0x088890dc',
  aeroRouteI: '0x5c20f68c',
  aeroRouteJ: '0xf2c42696',
  aeroRouteK: '0x1dcee3c8',
  aeroRouteL: '0x0f27c5c1',
  aeroRouteM: '0xe9ae5c53',
  aeroRouteN: '0x73fc4457',
  aeroRouteO: '0xc7a76969',
  aeroRouteP: '0x1c5cf072',
  aeroRouteQ: '0x09c182c3',
  aeroRouteR: '0x4dbe83ed',
  aeroRouteS: '0xbc61b9ce',
} as const;

export function isSwapTransaction(txData: string): boolean {
  if (!txData || txData.length < 10) return false;

  const selector = txData.slice(0, 10).toLowerCase();
  return Object.values(DEX_SIGNATURES).some((signature) => signature.toLowerCase() === selector);
}

export function shouldAttemptTransferBasedDecode(params: {
  hasPoolSwapEvidence: boolean;
  hasDexIntentEvidence: boolean;
  logs: TransferLog[];
  walletAddress: string;
  nativeValue?: string;
  decodeMode?: 'live' | 'history';
}): boolean {
  if (params.hasPoolSwapEvidence || params.hasDexIntentEvidence) return true;
  if (params.decodeMode === 'history') return false;
  return hasLikelyTransferSwapEvidence(params.logs, params.walletAddress, params.nativeValue || '0');
}
