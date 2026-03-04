import prisma from '../../../db/prisma.js';
import {
  findLedgerFirstMonitorPositions,
  findLedgerFirstPendingCleanupPositionIds,
  findLedgerFirstRetryPositions,
  markLedgerPendingCleanup,
} from '../ledger/copytradeLedgerSelectors.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';

export async function cleanupPendingCopytradeJobs(params: {
  lockStatuses: string[];
  failedFinalStatus: string;
  createdBefore: Date;
}) {
  const positionIds = await findLedgerFirstPendingCleanupPositionIds({
    createdBefore: params.createdBefore,
  });
  if (positionIds.length === 0) {
    emitCopytradeSummaryAudit('CLEANUP_CYCLE_SUMMARY', {
      action: 'noop',
      candidateCount: 0,
      legacyFallbackUsed: false,
    });
    return { count: 0, legacyFallbackUsed: false };
  }

  const closedAt = new Date();
  const result = await prisma.position.updateMany({
    where: {
      id: { in: positionIds },
      status: { in: params.lockStatuses as any },
    },
    data: {
      status: params.failedFinalStatus as any,
      exitReason: 'pending_timeout',
      closedAt,
    },
  });
  const ledgerUpdated = await markLedgerPendingCleanup({
    positionIds,
    reasonCode: 'pending_timeout',
    closedAt,
  });
  emitCopytradeSummaryAudit('CLEANUP_CYCLE_SUMMARY', {
    action: result.count > 0 ? 'mark_terminal_failed' : 'noop',
    candidateCount: positionIds.length,
    updatedCount: result.count,
    ledgerUpdatedCount: ledgerUpdated,
    legacyFallbackUsed: false,
  });
  return { count: result.count, legacyFallbackUsed: false };
}

export async function loadLedgerFirstRetryPositions(params: {
  retryBefore: Date;
}) {
  const positions = await findLedgerFirstRetryPositions(params);
  emitCopytradeSummaryAudit('RETRY_CYCLE_SUMMARY', {
    action: positions.length > 0 ? 'load_candidates' : 'noop',
    candidateCount: positions.length,
    legacyFallbackUsed: false,
  });
  return positions;
}

export async function loadLedgerFirstMonitorPositions() {
  const positions = await findLedgerFirstMonitorPositions();
  emitCopytradeSummaryAudit('MONITOR_CYCLE_SUMMARY', {
    action: positions.length > 0 ? 'load_candidates' : 'noop',
    candidateCount: positions.length,
    legacyFallbackUsed: false,
  });
  return positions;
}
