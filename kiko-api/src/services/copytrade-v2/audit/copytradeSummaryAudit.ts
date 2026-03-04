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
  | 'REPAIR_CYCLE_SUMMARY';

export function emitCopytradeSummaryAudit(
  event: CopytradeSummaryEvent,
  fields: Record<string, unknown>,
): void {
  logger.info(LogCode.SYS_INFO, `[CopyTradeSummary] ${event}`, {
    engineMode: resolveCopytradeEngineMode(),
    ledgerMode: resolveCopytradeLedgerMode(),
    ...fields,
  });
}
