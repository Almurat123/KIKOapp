import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { persistTerminalExitBlockState } from '../exit/persistence.js';
import { advanceCanonicalOrderState } from '../orders/canonicalOrderState.js';

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Avery Lin
// Reason: Historical terminal mirror-sell failures created open-position ghosts
//         before the exit worker learned to archive them at failure time.
// Goal: Remove terminally failed mirror-sell positions from the open monitor pool
//       even when the parent position never received a closedAt marker.
// Owns: Detecting and reconciling open positions whose latest exit intent is already
//       terminal-failed.
// Does Not Own: Exit execution, quote classification, or new exit-intent creation.
// Design Language:
// - A terminal exit intent must dominate an open position ghost.
// - Reconciliation must update both position state and canonical order state.
// - Do not wait for price snapshots to clean terminal failures.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-08-terminal-exit-ghost-position.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-terminal-exit-ghost-reconciler.md

type GhostPosition = {
  id: string;
  status?: string | null;
  tokenAddress: string;
  tokenSymbol?: string | null;
  chainId: number;
  userId?: string | null;
  configId?: string | null;
};

type TerminalIntent = {
  id: string;
  lifecycleState?: string | null;
  lastReasonCode?: string | null;
  targetSellTxHash?: string | null;
  metadata?: Record<string, unknown> | null;
  closedAt?: Date | string | null;
};

type Deps = {
  persistTerminalExitBlockState: typeof persistTerminalExitBlockState;
  advanceCanonicalOrderState: typeof advanceCanonicalOrderState;
};

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = String(metadata?.[key] || '').trim();
  return value || null;
}

export async function reconcileTerminalExitGhostPosition(params: {
  position: GhostPosition;
  terminalIntent?: TerminalIntent | null;
  deps?: Partial<Deps>;
}): Promise<{ repaired: boolean; reasonCode?: string | null }> {
  const position = params.position;
  const terminalIntent = params.terminalIntent;
  if (String(position.status || '').toLowerCase() !== 'open') return { repaired: false };
  if (!terminalIntent) return { repaired: false };
  if (String(terminalIntent.lifecycleState || '').toUpperCase() !== 'EXIT_FAILED_TERMINAL') {
    return { repaired: false };
  }

  const deps: Deps = {
    persistTerminalExitBlockState: params.deps?.persistTerminalExitBlockState || persistTerminalExitBlockState,
    advanceCanonicalOrderState: params.deps?.advanceCanonicalOrderState || advanceCanonicalOrderState,
  };

  const reasonCode = String(
    terminalIntent.lastReasonCode
    || readMetadataString(terminalIntent.metadata, 'terminalReasonCode')
    || 'exit_failed_terminal',
  ).trim();
  const targetWallet = readMetadataString(terminalIntent.metadata, 'targetWallet');
  const orderId = readMetadataString(terminalIntent.metadata, 'orderId');

  await deps.persistTerminalExitBlockState({
    positions: [position as any],
    targetWallet,
    reasonCode,
  }).catch(() => undefined);

  if (orderId) {
    await deps.advanceCanonicalOrderState({
      orderId,
      lifecycleState: 'FAILED_TERMINAL',
      reasonCode,
      eventType: 'ORDER_EXIT_FAILED_TERMINAL_RECONCILED',
      metadataPatch: {
        targetSellTxHash: terminalIntent.targetSellTxHash || null,
        positionIdLegacy: position.id,
        lastKnownExposureSource: 'terminal_exit_reconciler',
      },
      closedAt: new Date(),
    }).catch(() => null);
  }

  logger.warn(LogCode.WTC_TX_SKIPPED, 'Terminal exit ghost position reconciled out of open pool', {
    positionId: position.id,
    userId: position.userId || undefined,
    configId: position.configId || undefined,
    token: position.tokenSymbol || position.tokenAddress,
    chainId: position.chainId,
    exitIntentId: terminalIntent.id,
    reasonCode,
    targetSellTxHash: terminalIntent.targetSellTxHash || null,
    orderId: orderId || null,
    intentClosedAt: terminalIntent.closedAt ? new Date(terminalIntent.closedAt).toISOString() : null,
  });

  return { repaired: true, reasonCode };
}
