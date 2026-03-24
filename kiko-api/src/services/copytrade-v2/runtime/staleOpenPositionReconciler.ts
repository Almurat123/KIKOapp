import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';

type StaleOpenPosition = {
  id: string;
  status?: string | null;
  exitReason?: string | null;
  exitTxHash?: string | null;
  closedAt?: Date | string | null;
  tokenAddress: string;
  tokenSymbol?: string | null;
  chainId: number;
  userId?: string | null;
  configId?: string | null;
};

type ReconcileDeps = {
  updateMany: (args: {
    where: { id: string; status: string };
    data: { status: string; exitReason?: string | undefined; exitTxHash?: string | undefined; closedAt: Date };
  }) => Promise<{ count: number }>;
  syncLedger: (args: {
    positionId: string;
    lifecycleState: string;
    followerExitTxHash?: string | undefined;
    lastExecutionState: string;
    lastExecutionReasonCode: string;
    closedAt: Date;
  }) => Promise<unknown>;
};

export async function reconcileStaleOpenClosedPosition(params: {
  position: StaleOpenPosition;
  deps?: Partial<ReconcileDeps>;
}): Promise<{ repaired: boolean }> {
  const position = params.position;
  if (String(position.status || '').toLowerCase() !== 'open') return { repaired: false };
  const closedAt = position.closedAt ? new Date(position.closedAt) : null;
  if (!closedAt || Number.isNaN(closedAt.getTime())) return { repaired: false };

  const deps: ReconcileDeps = {
    updateMany: params.deps?.updateMany || (prisma.position.updateMany.bind(prisma.position) as unknown as ReconcileDeps['updateMany']),
    syncLedger: params.deps?.syncLedger || (syncCopytradeLedgerFromLegacy as ReconcileDeps['syncLedger']),
  };

  const updateResult = await deps.updateMany({
    where: {
      id: position.id,
      status: 'open',
    },
    data: {
      status: 'closed',
      exitReason: position.exitReason || undefined,
      exitTxHash: position.exitTxHash || undefined,
      closedAt,
    },
  }).catch(() => ({ count: 0 }));

  if (!updateResult.count) {
    return { repaired: false };
  }

  await deps.syncLedger({
    positionId: position.id,
    lifecycleState: 'FOLLOWER_CLOSED',
    followerExitTxHash: position.exitTxHash || undefined,
    lastExecutionState: 'confirmed_success',
    lastExecutionReasonCode: `stale_open_repaired:${String(position.exitReason || 'closed')}`,
    closedAt,
  }).catch(() => null);

  logger.warn(LogCode.WTC_TX_SKIPPED, 'Stale open position reconciled closed before TP/SL', {
    positionId: position.id,
    userId: position.userId || undefined,
    configId: position.configId || undefined,
    token: position.tokenSymbol || position.tokenAddress,
    chainId: position.chainId,
    exitReason: position.exitReason || null,
    exitTxHash: position.exitTxHash || null,
    closedAt: closedAt.toISOString(),
  });

  return { repaired: true };
}
