import { projectCopytradeLedgerSnapshot } from './copytradeLedgerProjector.js';
import type { CopytradeLedgerSnapshot } from './copytradeLedgerTypes.js';
import { resolvePositionLedgerSnapshot } from '../positions/positionLedgerResolver.js';
import type { PositionLedgerPosition } from '../positions/positionLedgerSnapshot.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';
import { resolveCopytradeLedgerMode } from './copytradeLedgerMode.js';
import {
  inferLedgerLifecycleStateFromSnapshot,
  loadCopytradeLedgerByPositionIds,
  syncCopytradeLedgerFromLegacy,
} from './copytradeLedgerRepository.js';

export async function resolveCopytradeLedger(params: {
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
  positions?: PositionLedgerPosition[];
  pendingLots?: PendingAttributedPositionLotLike[];
  positionIds?: string[];
}): Promise<CopytradeLedgerSnapshot> {
  const ledgerMode = resolveCopytradeLedgerMode();
  if (ledgerMode === 'v2_primary' && params.positionIds?.length) {
    const physical = await loadCopytradeLedgerByPositionIds({ positionIds: params.positionIds });
    if (physical) {
      const snapshot = await resolvePositionLedgerSnapshot(params);
      const projected = projectCopytradeLedgerSnapshot(snapshot);
      return {
        ...projected,
        latestTargetSellTxHash: physical.latestTargetSellTxHash || projected.latestTargetSellTxHash,
        targetFullExitVerified: physical.targetFullExitVerified ?? projected.targetFullExitVerified,
        metrics: {
          ...projected.metrics,
          effectiveOwnedAmountRaw: physical.metrics.effectiveOwnedAmountRaw || projected.metrics.effectiveOwnedAmountRaw,
        },
        reasonCode: physical.reasonCode || projected.reasonCode,
      };
    }
  }

  const snapshot = await resolvePositionLedgerSnapshot(params);
  const projected = projectCopytradeLedgerSnapshot(snapshot);
  if (ledgerMode === 'v2_primary' && params.positionIds?.length) {
    for (const positionId of params.positionIds) {
      await syncCopytradeLedgerFromLegacy({
        positionId,
        targetWallet: params.targetWallet,
        lifecycleState: inferLedgerLifecycleStateFromSnapshot(projected),
        targetSellTxHash: projected.latestTargetSellTxHash || undefined,
      }).catch(() => null);
    }
  }
  return projected;
}
