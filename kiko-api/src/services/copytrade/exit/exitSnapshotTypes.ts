import type {
  AttributedPositionLike,
  PositionAttributionReasonCode,
  PositionAttributionResult,
} from '../positions/positionAttribution.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';
import type { RpcFactResult } from '../../oracle/rpcFactResult.js';

export interface ExitSnapshotPosition extends AttributedPositionLike {
  id: string;
  status?: string | null;
  leaderTxHash?: string | null;
  createdAt?: Date | null;
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
  balanceRead: RpcFactResult<bigint>;
  positions: ExitSnapshotPosition[];
  pendingLots: PendingAttributedPositionLotLike[];
  latestTargetSellTxHash?: string | null;
  targetFullExitVerified?: boolean;
  targetFullExitReasonCode?: string | null;
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
