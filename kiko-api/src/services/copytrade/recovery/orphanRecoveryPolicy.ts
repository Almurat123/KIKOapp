import type { ExitAttributionSnapshot } from '../exit/exitSnapshotTypes.js';

export type OrphanRecoveryAction = 'noop' | 'force_exit' | 'quarantine';

export interface OrphanRecoveryDecision {
  action: OrphanRecoveryAction;
  reasonCode: string;
}

export function evaluateOrphanRecovery(snapshot: ExitAttributionSnapshot): OrphanRecoveryDecision {
  if (!snapshot.isMirrorSell) {
    return { action: 'noop', reasonCode: 'orphan_recovery_not_mirror_sell' };
  }
  if (!snapshot.targetFullExitVerified) {
    return { action: 'noop', reasonCode: 'orphan_recovery_target_exit_unverified' };
  }

  const openPositions = snapshot.positions.filter((position) => String(position.status || '').toLowerCase() === 'open');
  // Mirror-sell must never auto-close DB position on a single zero-balance read.
  // Keep position open and let retry/next sell signal handle eventual consistency.
  if (snapshot.balanceRaw <= 0n) {
    return { action: 'noop', reasonCode: 'orphan_recovery_target_exit_balance_empty_keep_open' };
  }
  if (!snapshot.latestTargetSellTxHash) {
    return { action: 'quarantine', reasonCode: 'orphan_recovery_missing_target_sell_link' };
  }
  if (openPositions.length !== 1) {
    return { action: 'quarantine', reasonCode: 'orphan_recovery_non_unique_open_position' };
  }
  if (snapshot.pendingLots.length > 0) {
    return { action: 'quarantine', reasonCode: 'orphan_recovery_pending_lots_present' };
  }
  if (snapshot.attribution.hasExternalBalance) {
    return { action: 'quarantine', reasonCode: 'orphan_recovery_external_balance_detected' };
  }

  return { action: 'force_exit', reasonCode: 'orphan_recovery_force_exit_from_verified_target_sell' };
}
