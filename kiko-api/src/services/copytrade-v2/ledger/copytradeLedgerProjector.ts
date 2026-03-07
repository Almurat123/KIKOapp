import { ethers } from 'ethers';

import type { CopytradeLedgerReasonCode, CopytradeLedgerSnapshot } from './copytradeLedgerTypes.js';
import type { PositionLedgerSnapshot } from '../positions/positionLedgerSnapshot.js';

function toRawAmount(value: unknown): bigint {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '0') return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

function toRawFromDecimal(value: unknown): bigint {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '0') return 0n;
  try {
    return ethers.parseUnits(normalized, 18);
  } catch {
    return 0n;
  }
}

function sumConfirmedOwnedAmountRaw(snapshot: PositionLedgerSnapshot): bigint {
  return snapshot.positions.reduce((total, position) => {
    if (String(position.status || '').toLowerCase() === 'closed') return total;
    const exact = toRawAmount(position.entryAmountExact);
    if (exact > 0n) return total + exact;
    return total + toRawFromDecimal(position.entryAmountDec);
  }, 0n);
}

function sumPendingOwnedAmountRaw(snapshot: PositionLedgerSnapshot): bigint {
  return snapshot.pendingLots.reduce((total, lot) => {
    const status = String(lot.status || '').toLowerCase();
    if (status !== 'armed' && status !== 'sell_armed') return total;
    return total + toRawAmount(lot.expectedAmountRaw);
  }, 0n);
}

function reasonCodeForLifecyclePhase(phase: PositionLedgerSnapshot['lifecyclePhase']): CopytradeLedgerReasonCode {
  switch (phase) {
    case 'pending_only':
      return 'LEDGER_PENDING_ONLY';
    case 'open_only':
      return 'LEDGER_OPEN_ONLY';
    case 'mixed':
      return 'LEDGER_MIXED';
    case 'closed_only':
      return 'LEDGER_CLOSED_ONLY';
    default:
      return 'LEDGER_EMPTY';
  }
}

export function projectCopytradeLedgerSnapshot(snapshot: PositionLedgerSnapshot): CopytradeLedgerSnapshot {
  const confirmedOwnedAmountRaw = sumConfirmedOwnedAmountRaw(snapshot);
  const pendingOwnedAmountRaw = sumPendingOwnedAmountRaw(snapshot);
  const effectiveOwnedAmountRaw = confirmedOwnedAmountRaw > 0n
    ? confirmedOwnedAmountRaw
    : pendingOwnedAmountRaw;
  const openPositionCount = snapshot.positions.filter((position) =>
    String(position.status || '').toLowerCase() === 'open',
  ).length;
  const armedPendingLotCount = snapshot.pendingLots.filter((lot) =>
    String(lot.status || '').toLowerCase() === 'armed',
  ).length;
  const sellArmedPendingLotCount = snapshot.pendingLots.filter((lot) =>
    String(lot.status || '').toLowerCase() === 'sell_armed',
  ).length;

  return {
    chainId: snapshot.chainId,
    tokenAddress: snapshot.tokenAddress,
    userId: snapshot.userId,
    positionIds: snapshot.positionIds,
    positions: snapshot.positions,
    pendingLots: snapshot.pendingLots,
    latestTargetSellTxHash: snapshot.latestTargetSellTxHash,
    latestTargetSellAt: snapshot.latestTargetSellAt,
    targetFullExitVerified: snapshot.targetFullExitVerified,
    lifecyclePhase: snapshot.lifecyclePhase,
    metrics: {
      openPositionCount,
      pendingLotCount: snapshot.pendingLots.length,
      armedPendingLotCount,
      sellArmedPendingLotCount,
      confirmedOwnedAmountRaw,
      pendingOwnedAmountRaw,
      effectiveOwnedAmountRaw,
      trackedEntryRaw: effectiveOwnedAmountRaw,
      trackedRemainingRaw: effectiveOwnedAmountRaw,
      trackedSoldRaw: 0n,
      externalBalanceDetected: false,
      lastMirroredTargetSellTxHash: snapshot.latestTargetSellTxHash || null,
      lastMirroredRatioBps: null,
      exitExecutionState: null,
    },
    reasonCode: reasonCodeForLifecyclePhase(snapshot.lifecyclePhase),
  };
}
