import type { PositionLedgerLifecyclePhase, PositionLedgerPosition } from '../positions/positionLedgerSnapshot.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export type CopytradeLedgerReasonCode =
  | 'LEDGER_EMPTY'
  | 'LEDGER_PENDING_ONLY'
  | 'LEDGER_OPEN_ONLY'
  | 'LEDGER_MIXED'
  | 'LEDGER_CLOSED_ONLY';

export interface CopytradeLedgerSnapshot {
  chainId: number;
  tokenAddress: string;
  userId?: string | null;
  positionIds: string[];
  positions: PositionLedgerPosition[];
  pendingLots: PendingAttributedPositionLotLike[];
  latestTargetSellTxHash?: string | null;
  latestTargetSellAt?: Date | null;
  targetFullExitVerified?: boolean;
  lifecyclePhase: PositionLedgerLifecyclePhase;
  metrics: {
    openPositionCount: number;
    pendingLotCount: number;
    armedPendingLotCount: number;
    sellArmedPendingLotCount: number;
    confirmedOwnedAmountRaw: bigint;
    pendingOwnedAmountRaw: bigint;
    effectiveOwnedAmountRaw: bigint;
    trackedEntryRaw: bigint;
    trackedRemainingRaw: bigint;
    trackedSoldRaw: bigint;
    externalBalanceDetected?: boolean;
    lastMirroredTargetSellTxHash?: string | null;
    lastMirroredRatioBps?: number | null;
    exitExecutionState?: string | null;
  };
  reasonCode: CopytradeLedgerReasonCode;
}
