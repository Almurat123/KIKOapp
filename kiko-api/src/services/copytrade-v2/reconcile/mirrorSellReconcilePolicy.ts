import type { TargetFullExitVerificationResult } from './targetSellFullExitVerifier.js';
import type { MirrorSellIntentDecision } from '../positions/mirrorSellIntentPolicy.js';

export type DeferredMirrorSellIntentResult = MirrorSellIntentDecision & {
  reasonCode:
    | 'TARGET_SELL_SEEN_IN_LEDGER'
    | 'TARGET_SELL_SEEN_IN_HISTORY'
    | 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED'
    | 'NO_PENDING_MIRROR_SELL_INTENT';
};

export function evaluateDeferredMirrorSellIntent(params: {
  latestTargetSellTxHash?: string | null;
  armedLotAlreadyPresent?: boolean;
  strictFullExit?: TargetFullExitVerificationResult | null;
}): DeferredMirrorSellIntentResult {
  if (params.armedLotAlreadyPresent && params.latestTargetSellTxHash) {
    return {
      disposition: 'execute_immediately',
      targetSellTxHash: params.latestTargetSellTxHash,
      reasonCode: 'TARGET_SELL_SEEN_IN_LEDGER',
    };
  }

  if (!params.latestTargetSellTxHash) {
    return {
      disposition: 'none',
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  if (params.strictFullExit?.isFullExit === false) {
    return {
      disposition: 'arm_exit',
      targetSellTxHash: params.latestTargetSellTxHash,
      reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED',
    };
  }

  return {
    disposition: 'execute_immediately',
    targetSellTxHash: params.latestTargetSellTxHash,
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY',
  };
}
