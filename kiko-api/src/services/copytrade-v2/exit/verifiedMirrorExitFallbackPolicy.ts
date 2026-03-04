import type { ExitAttributionSnapshot, ExitSnapshotPosition } from './exitSnapshotTypes.js';
import type { PositionAttributionReasonCode } from '../positions/positionAttribution.js';

export interface VerifiedMirrorExitFallbackDecision {
  shouldFallback: boolean;
  sellAmountRaw: bigint;
  reasonCode: PositionAttributionReasonCode;
  positions: ExitSnapshotPosition[];
}

const VERIFIED_FALLBACK_REASON_CODES = new Set<PositionAttributionReasonCode>([
  'NO_CONFIRMED_POSITIONS',
  'ATTRIBUTED_AMOUNT_UNAVAILABLE',
  'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
  'PENDING_BALANCE_NOT_VISIBLE_YET',
]);

export function evaluateVerifiedMirrorExitFallback(
  snapshot: ExitAttributionSnapshot,
): VerifiedMirrorExitFallbackDecision {
  if (!snapshot.isMirrorSell || !snapshot.targetFullExitVerified) {
    return { shouldFallback: false, sellAmountRaw: 0n, reasonCode: snapshot.attribution.reasonCode, positions: snapshot.attribution.eligiblePositions };
  }
  if (!snapshot.latestTargetSellTxHash || snapshot.balanceRaw <= 0n) {
    return { shouldFallback: false, sellAmountRaw: 0n, reasonCode: snapshot.attribution.reasonCode, positions: snapshot.attribution.eligiblePositions };
  }
  if (!VERIFIED_FALLBACK_REASON_CODES.has(snapshot.attribution.reasonCode)) {
    return { shouldFallback: false, sellAmountRaw: 0n, reasonCode: snapshot.attribution.reasonCode, positions: snapshot.attribution.eligiblePositions };
  }
  const openPositions = snapshot.positions.filter((position) => String(position.status || '').toLowerCase() === 'open');
  if (openPositions.length !== 1 || snapshot.pendingLots.length > 0) {
    return { shouldFallback: false, sellAmountRaw: 0n, reasonCode: snapshot.attribution.reasonCode, positions: snapshot.attribution.eligiblePositions };
  }
  return {
    shouldFallback: true,
    sellAmountRaw: snapshot.balanceRaw,
    reasonCode: 'FULL_BALANCE_FALLBACK',
    positions: openPositions,
  };
}
