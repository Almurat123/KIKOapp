import type { DecodedSwap } from '../../txDecoder.js';
import { determineCopyTradeDirection, type CopyTradeCashLegHint } from '../../copyTradeDirection.js';
import { normalizeAddress } from '../../../utils/address.js';

export type EvmProvisionalIngressAction =
  | {
      action: 'dispatch_provisional';
      reasonCode:
        | 'single_wallet_predecoded_routable'
        | 'single_wallet_activity_routable';
      swapSource: 'webhook_provisional_predecoded' | 'webhook_provisional_activity';
      allowMissingSourceTxFrom: boolean;
    }
  | {
      action: 'require_receipt';
      reasonCode:
        | 'multiple_tracked_wallets'
        | 'pending_hint_wallet_conflict'
        | 'source_wallet_conflict'
        | 'swap_missing'
        | 'swap_tokens_invalid'
        | 'direction_not_routable'
        | 'direction_ambiguous'
        | 'direction_hint_conflict';
    };

export function decideEvmProvisionalIngress(params: {
  chainId: number;
  trackedWalletCount: number;
  trackedWallet: string;
  swapOrigin: 'cached_predecoded' | 'activity_decode';
  swap?: DecodedSwap | null;
  sourceTxFrom?: string | null;
  pendingHintTargetWallet?: string | null;
  cashLegHint?: CopyTradeCashLegHint | null;
}): EvmProvisionalIngressAction {
  if (params.trackedWalletCount !== 1) {
    return {
      action: 'require_receipt',
      reasonCode: 'multiple_tracked_wallets',
    };
  }

  const trackedWallet = normalizeAddress(params.trackedWallet);
  const sourceTxFrom = normalizeAddress(params.sourceTxFrom || '');
  const pendingHintTargetWallet = normalizeAddress(params.pendingHintTargetWallet || '');
  if (pendingHintTargetWallet && trackedWallet && pendingHintTargetWallet !== trackedWallet) {
    return {
      action: 'require_receipt',
      reasonCode: 'pending_hint_wallet_conflict',
    };
  }
  if (sourceTxFrom && trackedWallet && sourceTxFrom !== trackedWallet) {
    return {
      action: 'require_receipt',
      reasonCode: 'source_wallet_conflict',
    };
  }

  const swap = params.swap || null;
  if (!swap) {
    return {
      action: 'require_receipt',
      reasonCode: 'swap_missing',
    };
  }

  const tokenIn = normalizeAddress(String(swap.tokenIn || ''));
  const tokenOut = normalizeAddress(String(swap.tokenOut || ''));
  if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
    return {
      action: 'require_receipt',
      reasonCode: 'swap_tokens_invalid',
    };
  }

  const direction = determineCopyTradeDirection({
    chainId: params.chainId,
    tokenIn,
    tokenOut,
    cashLegHint: params.cashLegHint || undefined,
  });
  if (direction.hintConflict) {
    return {
      action: 'require_receipt',
      reasonCode: 'direction_hint_conflict',
    };
  }
  if (!direction.isRoutable) {
    return {
      action: 'require_receipt',
      reasonCode: direction.isAmbiguous ? 'direction_ambiguous' : 'direction_not_routable',
    };
  }

  return {
    action: 'dispatch_provisional',
    reasonCode: params.swapOrigin === 'cached_predecoded'
      ? 'single_wallet_predecoded_routable'
      : 'single_wallet_activity_routable',
    swapSource: params.swapOrigin === 'cached_predecoded'
      ? 'webhook_provisional_predecoded'
      : 'webhook_provisional_activity',
    allowMissingSourceTxFrom: !sourceTxFrom,
  };
}
