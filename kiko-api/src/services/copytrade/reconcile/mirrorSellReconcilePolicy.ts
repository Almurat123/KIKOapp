import type { TargetFullExitVerificationResult } from './targetSellFullExitVerifier.js';

export type DeferredMirrorSellIntentResult =
  | {
      shouldMirrorSell: false;
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT';
      targetSellTxHash?: undefined;
    }
  | {
      shouldMirrorSell: true;
      reasonCode:
        | 'TARGET_SELL_SEEN_IN_LEDGER'
        | 'TARGET_SELL_SEEN_IN_HISTORY'
        | 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED';
      targetSellTxHash: string;
    };

export function evaluateDeferredMirrorSellIntent(params: {
  latestTargetSellTxHash?: string | null;
  armedLotAlreadyPresent?: boolean;
  strictFullExit?: TargetFullExitVerificationResult | null;
}): DeferredMirrorSellIntentResult {
  if (params.armedLotAlreadyPresent && params.latestTargetSellTxHash) {
    return {
      shouldMirrorSell: true,
      targetSellTxHash: params.latestTargetSellTxHash,
      reasonCode: 'TARGET_SELL_SEEN_IN_LEDGER',
    };
  }

  if (!params.latestTargetSellTxHash) {
    return {
      shouldMirrorSell: false,
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  if (params.strictFullExit?.isFullExit === false) {
    return {
      shouldMirrorSell: true,
      targetSellTxHash: params.latestTargetSellTxHash,
      reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED',
    };
  }

  return {
    shouldMirrorSell: true,
    targetSellTxHash: params.latestTargetSellTxHash,
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY',
  };
}

