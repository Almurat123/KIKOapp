import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Avery Lin
// Reason: Production still showed old open positions staying inside the TP/SL loop even
//         after durable ledger state had already reached zero remaining exposure or
//         FOLLOWER_CLOSED, which kept warning forever after a real mirror sell.
// Goal: Let the monitor remove open-position ghosts when durable ledger evidence already
//       proves the follower exposure is fully closed.
// Owns: Reconciling legacy open positions from durable ledger closed-state evidence.
// Does Not Own: Detecting target sells, building exit intents, or pricing.
// Design Language:
// - Durable ledger closed-state must dominate legacy open ghosts.
// - Zero remaining exposure plus follower exit evidence is sufficient to close the ghost.
// - Do not infer closure from price or webhook activity alone.
// - Forbidden local patch patterns: keeping TP/SL monitoring alive after ledger says no exposure remains.
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1776053950823.json
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: proving TP/SL kept monitoring an old open position after mirror sell success
// - Verification: verified in runtime
// - Source: /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: monitor-side ghost cleanup must rely on durable owner state
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-position-monitor-price-fallback-and-ledger-ghost-repair.md

type LedgerClosedGhostPosition = {
  id: string;
  status?: string | null;
  tokenAddress: string;
  tokenSymbol?: string | null;
  chainId: number;
  userId?: string | null;
  configId?: string | null;
  exitReason?: string | null;
};

type LedgerClosureHint = {
  lifecycleState?: string | null;
  trackedRemainingRaw?: string | null;
  followerExitTxHash?: string | null;
  closedAt?: Date | string | null;
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

function parsePositiveBigInt(value: unknown): bigint {
  const raw = String(value || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export async function reconcileLedgerClosedGhostPosition(params: {
  position: LedgerClosedGhostPosition;
  ledgerHint?: LedgerClosureHint | null;
  deps?: Partial<ReconcileDeps>;
}): Promise<{ repaired: boolean; reasonCode?: string | null }> {
  const position = params.position;
  const ledgerHint = params.ledgerHint;
  if (String(position.status || '').toLowerCase() !== 'open') return { repaired: false };
  if (!ledgerHint) return { repaired: false };

  const lifecycleState = String(ledgerHint.lifecycleState || '').trim().toUpperCase();
  const trackedRemainingRaw = parsePositiveBigInt(ledgerHint.trackedRemainingRaw);
  const followerExitTxHash = String(ledgerHint.followerExitTxHash || '').trim() || null;
  const hintedClosedAt = ledgerHint.closedAt ? new Date(ledgerHint.closedAt) : null;
  const closedAt =
    hintedClosedAt && !Number.isNaN(hintedClosedAt.getTime())
      ? hintedClosedAt
      : new Date();

  const hasClosedLifecycle = lifecycleState === 'FOLLOWER_CLOSED' || lifecycleState === 'FOLLOWER_CLOSED_BEFORE_OPEN';
  const hasZeroRemainingWithExitEvidence = trackedRemainingRaw === 0n && Boolean(followerExitTxHash || hintedClosedAt);
  if (!hasClosedLifecycle && !hasZeroRemainingWithExitEvidence) {
    return { repaired: false };
  }

  const reasonCode = hasClosedLifecycle ? 'ledger_closed_ghost_repaired' : 'ledger_zero_remaining_ghost_repaired';
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
      exitReason: position.exitReason || 'mirror_sell',
      exitTxHash: followerExitTxHash || undefined,
      closedAt,
    },
  }).catch(() => ({ count: 0 }));

  if (!updateResult.count) {
    return { repaired: false };
  }

  await deps.syncLedger({
    positionId: position.id,
    lifecycleState: 'FOLLOWER_CLOSED',
    followerExitTxHash: followerExitTxHash || undefined,
    lastExecutionState: 'confirmed_success',
    lastExecutionReasonCode: reasonCode,
    closedAt,
  }).catch(() => null);

  logger.warn(LogCode.WTC_TX_SKIPPED, 'Ledger-closed ghost position reconciled out of TP/SL loop', {
    positionId: position.id,
    userId: position.userId || undefined,
    configId: position.configId || undefined,
    token: position.tokenSymbol || position.tokenAddress,
    chainId: position.chainId,
    lifecycleState: lifecycleState || null,
    trackedRemainingRaw: trackedRemainingRaw.toString(),
    followerExitTxHash,
    closedAt: closedAt.toISOString(),
    reasonCode,
  });

  return { repaired: true, reasonCode };
}
