import {
  evaluateMirrorSellGate,
  type MirrorSellGatePositionLike,
  type MirrorSellGateResult,
} from './mirrorSellGate.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export type MirrorSellExecutionPolicyResult =
  | (MirrorSellGateResult & {
      metrics: MirrorSellGateResult['metrics'] & {
        pendingAttributedLotCount: number;
      };
    });

export function evaluateMirrorSellExecutionPolicy<T extends MirrorSellGatePositionLike>(params: {
  matchedPositions: T[];
  pendingAttributedLots?: PendingAttributedPositionLotLike[];
}): MirrorSellExecutionPolicyResult {
  const gate = evaluateMirrorSellGate(params.matchedPositions);
  return {
    ...gate,
    metrics: {
      ...gate.metrics,
      pendingAttributedLotCount: params.pendingAttributedLots?.length || 0,
    },
  };
}
