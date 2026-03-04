import { normalizeAddress } from '../../../utils/address.js';
import { getDexName } from '../../txDecoder.js';
import { isSwapTransaction } from '../../txDecoder/evmSwapEvidence.js';

export type EthPendingSwapIntent = {
  side: 'buy' | 'unknown';
  selector: string;
  router: string;
  dexName: string;
  nativeValueWei: string;
  reasonCode: 'ETH_PENDING_NATIVE_SWAP_INTENT' | 'ETH_PENDING_SELECTOR_ONLY_INTENT';
};

export function inferEthPendingSwapIntent(params: {
  chainId: number;
  matchedWallet: string;
  tx: { from?: string; to?: string; input?: string; value?: string | bigint };
}): EthPendingSwapIntent | null {
  if (params.chainId !== 1) return null;
  const matchedWallet = normalizeAddress(params.matchedWallet || '');
  const from = normalizeAddress(String(params.tx?.from || ''));
  const router = normalizeAddress(String(params.tx?.to || ''));
  const input = String(params.tx?.input || '');
  const selector = input.startsWith('0x') ? input.slice(0, 10).toLowerCase() : '';
  if (!matchedWallet || !from || !router) return null;
  if (from !== matchedWallet) return null;
  if (!/^0x[0-9a-f]{8}$/.test(selector) || !isSwapTransaction(input)) return null;

  const rawValue = typeof params.tx?.value === 'bigint'
    ? params.tx.value
    : (() => {
        try {
          return BigInt(String(params.tx?.value || '0'));
        } catch {
          return 0n;
        }
      })();
  const side = rawValue > 0n ? 'buy' : 'unknown';
  const dexName = getDexName(router, params.chainId);
  return {
    side,
    selector,
    router,
    dexName,
    nativeValueWei: rawValue.toString(),
    reasonCode: rawValue > 0n ? 'ETH_PENDING_NATIVE_SWAP_INTENT' : 'ETH_PENDING_SELECTOR_ONLY_INTENT',
  };
}
