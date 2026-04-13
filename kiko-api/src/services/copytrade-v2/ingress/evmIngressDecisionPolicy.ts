import type { DecodedSwap } from '../../txDecoder.js';
import { determineCopyTradeDirection, type CopyTradeCashLegHint } from '../../copyTradeDirection.js';
import { normalizeAddress } from '../../../utils/address.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: Provisional webhook dispatch had drifted into accepting weak evidence before receipt confirmation.
// Goal: Keep provisional EVM ingress limited to strong evidence only so activity heuristics and untrusted predecode snapshots cannot directly enqueue money-moving work.
// Owns: The narrow rule for whether EVM webhook ingress may dispatch before receipt/full-tx confirmation.
// Does Not Own: Full swap decoding, durable target-sell truth, or downstream execution policy.
// Design Language:
// - Trusted predecode may fast-dispatch when wallet and direction checks pass.
// - Activity-only heuristics and untrusted predecode must wait for receipt/full-tx decode or recovery.
// - Forbidden local patch patterns: restoring activity-only provisional dispatch; treating pending snapshots as trusted without explicit trust policy.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: requiring receipt/recovery for weak ingress evidence
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: narrowing webhook runtime ownership to strong-evidence dispatch only
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-webhook-weak-evidence-dispatch-hardening.md

export type EvmProvisionalIngressAction =
  | {
      action: 'dispatch_provisional';
      reasonCode:
        | 'single_wallet_trusted_predecoded_routable';
      swapSource: 'webhook_provisional_predecoded';
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
        | 'direction_hint_conflict'
        | 'activity_decode_requires_receipt'
        | 'untrusted_predecode_requires_receipt';
    };

export function decideEvmProvisionalIngress(params: {
  chainId: number;
  trackedWalletCount: number;
  trackedWallet: string;
  swapOrigin: 'cached_predecoded' | 'activity_decode';
  predecodedTrusted?: boolean;
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

  if (params.swapOrigin === 'activity_decode') {
    return {
      action: 'require_receipt',
      reasonCode: 'activity_decode_requires_receipt',
    };
  }

  if (!params.predecodedTrusted) {
    return {
      action: 'require_receipt',
      reasonCode: 'untrusted_predecode_requires_receipt',
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
    reasonCode: 'single_wallet_trusted_predecoded_routable',
    swapSource: 'webhook_provisional_predecoded',
    allowMissingSourceTxFrom: !sourceTxFrom,
  };
}
