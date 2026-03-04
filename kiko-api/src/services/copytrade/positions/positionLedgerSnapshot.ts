import type { PendingAttributedPositionLotLike } from './pendingAttributedPositionLedger.js';
import type { ExitSnapshotPosition } from '../exit/exitSnapshotTypes.js';

export type PositionLedgerLifecyclePhase =
  | 'empty'
  | 'pending_only'
  | 'open_only'
  | 'mixed'
  | 'closed_only';

export interface PositionLedgerPosition extends ExitSnapshotPosition {
  userId?: string | null;
  configId?: string | null;
  leaderTxHash?: string | null;
  createdAt?: Date | null;
}

export interface PositionLedgerSnapshot {
  chainId: number;
  tokenAddress: string;
  userId?: string | null;
  positionIds: string[];
  positions: PositionLedgerPosition[];
  pendingLots: PendingAttributedPositionLotLike[];
  latestTargetSellTxHash?: string | null;
  latestTargetSellAt?: Date | null;
  lifecyclePhase: PositionLedgerLifecyclePhase;
}

export function derivePositionLedgerLifecyclePhase(params: {
  positions: Array<{ status?: string | null }>;
  pendingLots: PendingAttributedPositionLotLike[];
}): PositionLedgerLifecyclePhase {
  if (params.positions.length === 0 && params.pendingLots.length === 0) return 'empty';
  const statuses = new Set(params.positions.map((position) => String(position.status || '').toLowerCase()).filter(Boolean));
  const hasOpen = statuses.has('open');
  const hasClosed = statuses.has('closed');
  const hasActivePendingLots = params.pendingLots.some((lot) => ['armed', 'sell_armed'].includes(String(lot.status || '').toLowerCase()));
  const hasPendingLike = hasActivePendingLots || [...statuses].some((status) => status !== 'open' && status !== 'closed');

  if (hasOpen && hasPendingLike) return 'mixed';
  if (hasOpen) return 'open_only';
  if (hasPendingLike) return 'pending_only';
  if (hasClosed) return 'closed_only';
  return 'empty';
}
