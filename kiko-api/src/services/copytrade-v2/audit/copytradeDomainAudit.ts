import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { CopytradeLedgerSnapshot } from '../ledger/copytradeLedgerTypes.js';
import type { CopyTradeTimingSnapshot } from '../timing/copyTradeTimingModel.js';
import { buildCopyTradeTimingAuditFields } from '../timing/copyTradeTimingAudit.js';
import { buildExecutionLifecycleAuditFields } from '../../swap/lifecycle/executionLifecycleTranslator.js';
import type { MainSwapResult } from '../../MainSwapService.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';

export type CopytradeDomainEvent =
  | 'BUY_ACCEPTED_WAITING_CONFIRMATION'
  | 'BUY_CONFIRMATION_PROMOTED_OPEN'
  | 'BUY_CONFIRMATION_CLOSED_BEFORE_OPEN'
  | 'TARGET_FULL_EXIT_VERIFIED'
  | 'FOLLOWER_POSITION_NOT_SELLABLE'
  | 'FOLLOWER_EXIT_QUARANTINED'
  | 'FOLLOWER_POSITION_REPAIR_REQUIRED'
  | 'FOLLOWER_POSITION_REPAIRED'
  | 'FOLLOWER_EXIT_SUBMITTED'
  | 'FOLLOWER_EXIT_RETRY_SCHEDULED'
  | 'FOLLOWER_EXIT_CLOSED'
  | 'signal_wallet_mismatch'
  | 'solana_target_resolution_observed'
  | 'forced_mirror_exit_applied'
  | 'exit_confirmation_unresolved_retry'
  | 'exit_finality_pending'
  | 'exit_finality_confirmed'
  | 'quarantine_auto_repaired'
  | 'quarantine_repair_failed'
  | 'mirror_sell_idempotent_skip';

export function buildCopytradeDomainAuditFields(input: {
  ledger?: CopytradeLedgerSnapshot | null;
  timing?: CopyTradeTimingSnapshot;
  result?: Pick<MainSwapResult, 'success' | 'error' | 'txHash' | 'txLifecycle' | 'runtimeContext' | 'metadata'> | null;
  txLifecycle?: TxLifecycleResult | null;
  runtimeContext?: OrderRuntimeContext | null;
  error?: string | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const ledger = input.ledger;
  return {
    ...buildCopyTradeTimingAuditFields(input.timing),
    ...buildExecutionLifecycleAuditFields({
      result: input.result,
      txLifecycle: input.txLifecycle,
      runtimeContext: input.runtimeContext,
      error: input.error,
    }),
    ledgerLifecyclePhase: ledger?.lifecyclePhase || null,
    ledgerReasonCode: ledger?.reasonCode || null,
    ledgerOpenPositionCount: ledger?.metrics.openPositionCount ?? null,
    ledgerPendingLotCount: ledger?.metrics.pendingLotCount ?? null,
    ledgerArmedPendingLotCount: ledger?.metrics.armedPendingLotCount ?? null,
    ledgerSellArmedPendingLotCount: ledger?.metrics.sellArmedPendingLotCount ?? null,
    ledgerEffectiveOwnedAmountRaw: ledger?.metrics.effectiveOwnedAmountRaw?.toString?.() || null,
    latestTargetSellTxHash: ledger?.latestTargetSellTxHash || null,
    ...(input.extra || {}),
  };
}

export function emitCopytradeDomainAudit(
  event: CopytradeDomainEvent,
  input: Parameters<typeof buildCopytradeDomainAuditFields>[0],
): void {
  logger.info(LogCode.SYS_INFO, `[CopyTradeDomain] ${event}`, buildCopytradeDomainAuditFields(input));
}
