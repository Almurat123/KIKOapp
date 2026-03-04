import type {
  AttributedPositionLike,
  PositionAttributionReasonCode,
  PositionAttributionResult,
} from '../positions/positionAttribution.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export interface ExitSnapshotPosition extends AttributedPositionLike {
  id: string;
  status?: string | null;
}

export interface ExitAttributionSnapshot {
  tokenAddress: string;
  chainId: number;
  walletAddress: string;
  isMirrorSell: boolean;
  hasValidPrice: boolean;
  decimals: number;
  balanceRaw: bigint;
  balanceUsd: number;
  treatAsEmptyOrDust: boolean;
  positions: ExitSnapshotPosition[];
  pendingLots: PendingAttributedPositionLotLike[];
  latestTargetSellTxHash?: string | null;
  targetFullExitVerified?: boolean;
  attribution: {
    eligiblePositions: ExitSnapshotPosition[];
    pendingAttributedLotIds?: string[];
    sellAmountRaw: bigint;
    reasonCode: PositionAttributionReasonCode;
    metrics: Record<string, unknown>;
    hasExternalBalance: boolean;
  };
}

export type ExitSnapshotOpenAttribution = PositionAttributionResult<ExitSnapshotPosition>;
