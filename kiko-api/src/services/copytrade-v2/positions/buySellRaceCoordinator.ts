import prisma from '../../../db/prisma.js';
import { findLatestTargetSellEventSince, getTargetSellEvent } from '../exit/targetSellEventStore.js';
import { resolveTargetSellLink, type TargetSellLinkReasonCode } from '../reconcile/copytradeTargetSellLinkResolver.js';
import { getPendingAttributedPositionById } from './pendingAttributedPositionLedger.js';
import { normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import type { MirrorSellIntentDecision } from './mirrorSellIntentPolicy.js';
import { hasActiveExitIntent } from '../exit/positionExitIntentStore.js';

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Avery Lin
// Reason: The buy-confirmation owner must resolve mirror-sell races from pending lots,
//         active exit intents, and durable sell history so positions do not stall in
//         transitional states after out-of-order events.
// Goal: Ensure buy-confirmation can deterministically decide whether a mirrored sell
//       already exists, must be replayed, or is truly absent.
// Owns: Buy/sell race intent resolution for pending positions and durable sell replay.
// Does Not Own: Exit-intent scheduling, canonical order transitions, or monitor cleanup.
// Design Language:
// - Prefer authoritative pending/active intent state before replaying history.
// - Historical sell replay must be bounded to the current buy lifecycle window.
// - Do not treat missing pending lots as proof that no target sell happened.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-buy-confirm-target-sell-replay-gap.md

const TARGET_SELL_REPLAY_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.COPYTRADE_TARGET_SELL_REPLAY_WINDOW_MS || '600000'),
);

export type ResolvedPendingMirrorSellIntent = MirrorSellIntentDecision & {
  reasonCode:
    | 'PENDING_TARGET_SELL_ARMED'
    | 'ACTIVE_EXIT_INTENT_PRESENT'
    | 'NO_PENDING_MIRROR_SELL_INTENT';
};

export type ResolvedHistoricalTargetSellIntent = MirrorSellIntentDecision & {
  reasonCode:
    | TargetSellLinkReasonCode
    | 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE'
    | 'NO_HISTORICAL_TARGET_SELL';
  targetSellRatioBps?: number | null;
  targetFullExitVerified?: boolean;
  targetRemainingBalanceRaw?: string | null;
};

function subtractReplayWindow(date?: Date | null, replayWindowMs = TARGET_SELL_REPLAY_WINDOW_MS): Date | null {
  if (!(date instanceof Date)) return null;
  return new Date(date.getTime() - Math.max(1_000, replayWindowMs));
}

export async function resolvePendingMirrorSellIntent(params: {
  positionId?: string | null;
  targetWallet?: string | null;
  tokenAddress: string;
  chainId: number;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
}): Promise<ResolvedPendingMirrorSellIntent> {
  const positionId = String(params.positionId || '').trim();
  if (!positionId) {
    return {
      disposition: 'none',
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet) {
    return {
      disposition: 'none',
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  const [pendingLot, hasActiveIntent] = await Promise.all([
    getPendingAttributedPositionById(positionId).catch(() => null),
    hasActiveExitIntent(positionId).catch(() => false),
  ]);

  if (String(pendingLot?.status || '').toLowerCase() === 'sell_armed') {
    return {
      disposition: 'arm_exit',
      targetSellTxHash: pendingLot?.targetSellTxHash || undefined,
      reasonCode: 'PENDING_TARGET_SELL_ARMED',
    };
  }

  if (hasActiveIntent) {
    return {
      disposition: 'arm_exit',
      targetSellTxHash: pendingLot?.targetSellTxHash || undefined,
      reasonCode: 'ACTIVE_EXIT_INTENT_PRESENT',
    };
  }

  return {
    disposition: 'none',
    reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
  };
}

export async function resolveHistoricalTargetSellIntent(params: {
  targetWallet?: string | null;
  tokenAddress: string;
  chainId: number;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
  replayWindowMs?: number;
  deps?: {
    resolveTargetSellLink?: typeof resolveTargetSellLink;
    getTargetSellEvent?: typeof getTargetSellEvent;
    findLatestTargetSellEventSince?: typeof findLatestTargetSellEventSince;
  };
}): Promise<ResolvedHistoricalTargetSellIntent> {
  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet) {
    return {
      disposition: 'none',
      reasonCode: 'NO_HISTORICAL_TARGET_SELL',
    };
  }

  const resolveLinkedSell = params.deps?.resolveTargetSellLink || resolveTargetSellLink;
  const loadTargetSellEvent = params.deps?.getTargetSellEvent || getTargetSellEvent;
  const findReplayEvent = params.deps?.findLatestTargetSellEventSince || findLatestTargetSellEventSince;

  // First prefer an anchored sell linked to this buy lifecycle.
  const linkedSell = await resolveLinkedSell({
    targetWallet: normalizedWallet,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    leaderBuyTxHash: params.leaderBuyTxHash || undefined,
    positionCreatedAt: params.positionCreatedAt || null,
  }).catch(() => null);

  if (linkedSell?.txHash) {
    const persistedEvent = await loadTargetSellEvent({
      chainId: params.chainId,
      targetWallet: normalizedWallet,
      tokenAddress: params.tokenAddress,
      targetSellTxHash: linkedSell.txHash,
    }).catch(() => null);

    return {
      disposition: 'execute_immediately',
      targetSellTxHash: linkedSell.txHash,
      reasonCode: linkedSell.reasonCode,
      targetSellRatioBps: persistedEvent?.targetSellRatioBps ?? null,
      targetFullExitVerified: persistedEvent?.targetFullExitVerified ?? false,
      targetRemainingBalanceRaw: persistedEvent?.targetRemainingBalanceRaw ?? null,
    };
  }

  const detectedAfter = subtractReplayWindow(
    params.positionCreatedAt,
    params.replayWindowMs ?? TARGET_SELL_REPLAY_WINDOW_MS,
  );
  if (!(detectedAfter instanceof Date)) {
    return {
      disposition: 'none',
      reasonCode: 'NO_HISTORICAL_TARGET_SELL',
    };
  }

  // If wallet history is not ready yet, replay only recent durable sell events.
  const persistedEvent = await findReplayEvent({
    chainId: params.chainId,
    targetWallet: normalizedWallet,
    tokenAddress: params.tokenAddress,
    detectedAfter,
  }).catch(() => null);
  if (!persistedEvent?.targetSellTxHash) {
    return {
      disposition: 'none',
      reasonCode: 'NO_HISTORICAL_TARGET_SELL',
    };
  }

  return {
    disposition: 'execute_immediately',
    targetSellTxHash: persistedEvent.targetSellTxHash,
    reasonCode: 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE',
    targetSellRatioBps: persistedEvent.targetSellRatioBps,
    targetFullExitVerified: persistedEvent.targetFullExitVerified,
    targetRemainingBalanceRaw: persistedEvent.targetRemainingBalanceRaw,
  };
}

export async function resolveBuyConfirmationPromotionAction(params: {
  positionId?: string | null;
}): Promise<{
  action: 'promote_open' | 'already_open' | 'closed_before_open' | 'missing';
  status?: string | null;
  exitTxHash?: string | null;
  exitReason?: string | null;
}> {
  if (!params.positionId) return { action: 'missing' };
  const position = await prisma.position.findUnique({
    where: { id: params.positionId },
    select: { status: true, exitTxHash: true, exitReason: true },
  });
  if (!position) return { action: 'missing' };
  if (position.status === 'closed') {
    return {
      action: 'closed_before_open',
      status: position.status,
      exitTxHash: position.exitTxHash,
      exitReason: position.exitReason,
    };
  }
  if (position.status === 'open') {
    return {
      action: 'already_open',
      status: position.status,
      exitTxHash: position.exitTxHash,
      exitReason: position.exitReason,
    };
  }
  return {
    action: 'promote_open',
    status: position.status,
    exitTxHash: position.exitTxHash,
    exitReason: position.exitReason,
  };
}
