import {
  evaluateMirrorSellGate,
  type MirrorSellGatePositionLike,
} from './mirrorSellGate.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';
import {
  resolveEligibleMirrorSellPositions,
  type MirrorSellAttributedPositionLike,
} from './mirrorSellAttributionGuard.js';

export type MirrorSellExecutionPolicyResult =
  | {
      allowed: false;
      reasonCode:
        | 'MIRROR_SELL_NO_ATTRIBUTED_EXPOSURE'
        | 'MIRROR_SELL_BLOCKED_UNVERIFIED_OPEN_EXPOSURE';
      eligiblePositions: MirrorSellGatePositionLike[];
      eligiblePendingAttributedLots: PendingAttributedPositionLotLike[];
      metrics: {
        matchedPositionCount: number;
        pendingPositionCount: number;
        openPositionCount: number;
        pendingAttributedLotCount: number;
        sourceMatchedPositionCount: number;
        configScopedPositionCount: number;
        leaderLinkedPositionCount: number;
        verifiedLedgerPositionCount: number;
        blockedPositionCount: number;
      };
    }
  | {
      allowed: true;
      reasonCode:
        | 'MIRROR_SELL_ALLOWED_OPEN_EXPOSURE'
        | 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE'
        | 'MIRROR_SELL_ALLOWED_MIXED_EXPOSURE';
      eligiblePositions: MirrorSellGatePositionLike[];
      eligiblePendingAttributedLots: PendingAttributedPositionLotLike[];
      metrics: {
        matchedPositionCount: number;
        pendingPositionCount: number;
        openPositionCount: number;
        pendingAttributedLotCount: number;
        sourceMatchedPositionCount: number;
        configScopedPositionCount: number;
        leaderLinkedPositionCount: number;
        verifiedLedgerPositionCount: number;
        blockedPositionCount: number;
      };
    };

export function evaluateMirrorSellExecutionPolicy<T extends MirrorSellGatePositionLike & MirrorSellAttributedPositionLike>(params: {
  matchedPositions: T[];
  pendingAttributedLots?: PendingAttributedPositionLotLike[];
  expectedConfigId?: string | null;
  verifiedLedgerPositionIds?: Iterable<string>;
}): MirrorSellExecutionPolicyResult {
  const eligibility = resolveEligibleMirrorSellPositions({
    positions: params.matchedPositions,
    expectedConfigId: params.expectedConfigId,
    pendingAttributedLots: params.pendingAttributedLots,
    verifiedLedgerPositionIds: params.verifiedLedgerPositionIds,
  });
  const gate = evaluateMirrorSellGate(eligibility.eligiblePositions);
  const metrics = {
    ...gate.metrics,
    pendingAttributedLotCount: params.pendingAttributedLots?.length || 0,
    ...eligibility.metrics,
  };

  if (!gate.allowed) {
    return {
      allowed: false,
      reasonCode: params.matchedPositions.length > 0
        ? 'MIRROR_SELL_BLOCKED_UNVERIFIED_OPEN_EXPOSURE'
        : gate.reasonCode,
      eligiblePositions: eligibility.eligiblePositions,
      eligiblePendingAttributedLots: eligibility.eligiblePendingAttributedLots,
      metrics,
    };
  }

  return {
    allowed: true,
    reasonCode: gate.reasonCode,
    eligiblePositions: eligibility.eligiblePositions,
    eligiblePendingAttributedLots: eligibility.eligiblePendingAttributedLots,
    metrics,
  };
}
