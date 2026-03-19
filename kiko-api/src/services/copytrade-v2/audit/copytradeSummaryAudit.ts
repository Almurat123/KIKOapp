import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { resolveCopytradeEngineMode, resolveCopytradeLedgerMode } from '../ledger/copytradeLedgerMode.js';

export type CopytradeSummaryEvent =
  | 'BUY_FLOW_SUMMARY'
  | 'EXIT_FLOW_SUMMARY'
  | 'RECONCILE_CYCLE_SUMMARY'
  | 'CLEANUP_CYCLE_SUMMARY'
  | 'RETRY_CYCLE_SUMMARY'
  | 'MONITOR_CYCLE_SUMMARY'
  | 'REPAIR_CYCLE_SUMMARY'
  | 'ORPHAN_SWEEP_CYCLE_SUMMARY';

function hasMeaningfulSummaryWork(fields: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(fields)) {
    if (
      key === 'action'
      || key === 'legacyFallbackUsed'
      || key.endsWith('Mode')
      || key.endsWith('Count') && Number(value) === 0
    ) {
      // continue into numeric handling below for counts
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return true;
    }
    if (typeof value === 'boolean' && value) {
      return true;
    }
  }
  return false;
}

export function shouldEmitCopytradeSummaryAuditAtInfo(
  event: CopytradeSummaryEvent,
  fields: Record<string, unknown>,
): boolean {
  if (
    event === 'RECONCILE_CYCLE_SUMMARY'
    || event === 'REPAIR_CYCLE_SUMMARY'
    || event === 'ORPHAN_SWEEP_CYCLE_SUMMARY'
  ) {
    const action = String(fields.action || '').trim().toLowerCase();
    if (action === 'noop') return false;
    return hasMeaningfulSummaryWork(fields);
  }
  return true;
}

export function emitCopytradeSummaryAudit(
  event: CopytradeSummaryEvent,
  fields: Record<string, unknown>,
): void {
  const level = shouldEmitCopytradeSummaryAuditAtInfo(event, fields) ? 'info' : 'debug';
  logger[level](LogCode.SYS_INFO, `[CopyTradeSummary] ${event}`, {
    engineMode: resolveCopytradeEngineMode(),
    ledgerMode: resolveCopytradeLedgerMode(),
    ...fields,
  });
}
