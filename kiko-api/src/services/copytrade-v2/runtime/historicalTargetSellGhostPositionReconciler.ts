import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import {
  releaseMirrorSellAfterBuyConfirm,
  type MirrorSellReleaseResult,
} from '../buy/buyConfirmationMirrorSellRelease.js';
import { resolveHistoricalTargetSellIntent } from '../positions/buySellRaceCoordinator.js';

// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Avery Lin
// Reason: Some positions became durable `open` exposure before the historical target-sell
//         replay existed, so production kept monitoring them forever with no exit intent.
//         The reconciler also must not misreport idempotent reuse of an already-active
//         exit intent as a fresh historical replay.
// Goal: Let the monitor recover old open-position ghosts by replaying already-persisted
//       target-sell history into the durable mirror-sell scheduler.
// Owns: Detecting open positions that missed historical target-sell replay and scheduling
//       the missing exit work.
// Does Not Own: Target-sell detection, TP/SL policy, or exit execution.
// Design Language:
// - Monitor-side orphan repair must reuse the same durable mirror-sell path as buy-confirm.
// - Do not run TP/SL checks for open positions that already have active exit work.
// - Only replay bounded historical sell evidence anchored to the same buy lifecycle.
// - Do not emit "replayed" warnings when the durable scheduler only reused an already-active exit intent.
// Document Provenance:
// - Source: Production PostgreSQL runtime data for position cmnqjfh2o1zb1oh6sq19ku2hf
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: confirming open ghost shape with durable target-sell history and no exit intent
// - Verification: verified in runtime
// - Source: system-journal/fix-log/2026-04-10-open-position-historical-target-sell-reconciler.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: monitor-side orphan historical target-sell replay policy
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776159582066.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: separating true replay from active-intent idempotent reuse for ghost repair logging
// - Verification: verified in runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-open-position-historical-target-sell-reconciler.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-historical-target-sell-release-result-semantics.md

type OpenPositionGhost = {
  id: string;
  status?: string | null;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol?: string | null;
  leaderTxHash?: string | null;
  createdAt?: Date | null;
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
};

type ReconcilerDeps = {
  resolveHistoricalTargetSellIntent: typeof resolveHistoricalTargetSellIntent;
  releaseMirrorSellAfterBuyConfirm: typeof releaseMirrorSellAfterBuyConfirm;
};

function isDurableExitWorkPresent(result: MirrorSellReleaseResult): boolean {
  return result.outcome === 'scheduled' || result.outcome === 'already_active' || result.outcome === 'armed_pending';
}

export async function reconcileHistoricalTargetSellGhostPosition(params: {
  position: OpenPositionGhost;
  targetWallet?: string | null;
  hasActiveExitIntent?: boolean;
  deps?: Partial<ReconcilerDeps>;
}): Promise<{ repaired: boolean; targetSellTxHash?: string | null; reasonCode?: string | null }> {
  const position = params.position;
  const targetWallet = String(params.targetWallet || '').trim();
  if (String(position.status || '').toLowerCase() !== 'open') return { repaired: false };
  if (!targetWallet) return { repaired: false };
  if (params.hasActiveExitIntent) return { repaired: false };

  const deps: ReconcilerDeps = {
    resolveHistoricalTargetSellIntent: params.deps?.resolveHistoricalTargetSellIntent || resolveHistoricalTargetSellIntent,
    releaseMirrorSellAfterBuyConfirm: params.deps?.releaseMirrorSellAfterBuyConfirm || releaseMirrorSellAfterBuyConfirm,
  };

  // Resolve only bounded historical evidence from the same buy lifecycle window.
  const historicalIntent = await deps.resolveHistoricalTargetSellIntent({
    targetWallet,
    tokenAddress: position.tokenAddress,
    chainId: position.chainId,
    leaderBuyTxHash: position.leaderTxHash || undefined,
    positionCreatedAt: position.createdAt || null,
  }).catch(() => null);
  if (historicalIntent?.disposition !== 'execute_immediately') {
    return { repaired: false };
  }

  // Reuse the durable mirror-sell scheduler so monitor recovery and buy-confirm
  // replay create the same exit-intent shape.
  const releaseResult = await deps.releaseMirrorSellAfterBuyConfirm({
    position: {
      id: position.id,
      status: position.status || 'open',
      userId: position.userId,
      configId: position.configId,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      entryAmountExact: position.entryAmountExact,
      entryAmountDec: position.entryAmountDec,
    },
    chainId: position.chainId,
    tokenAddress: position.tokenAddress,
    targetWallet,
    targetSellTxHash: historicalIntent.targetSellTxHash || null,
    targetSellRatioBps: historicalIntent.targetSellRatioBps ?? null,
    targetFullExitVerified: historicalIntent.targetFullExitVerified,
    targetRemainingBalanceRaw: historicalIntent.targetRemainingBalanceRaw ?? null,
    reasonCode: historicalIntent.reasonCode,
    disposition: historicalIntent.disposition,
    sourceRuntime: 'position_monitor_historical_target_sell_reconciler',
  }).catch(() => ({ outcome: 'not_scheduled' as const }));
  if (!isDurableExitWorkPresent(releaseResult)) {
    return {
      repaired: false,
      targetSellTxHash: historicalIntent.targetSellTxHash || null,
      reasonCode: historicalIntent.reasonCode,
    };
  }

  if (releaseResult.outcome === 'scheduled') {
    logger.warn(LogCode.WTC_TX_SKIPPED, 'Historical target sell ghost position replayed into exit flow', {
      positionId: position.id,
      userId: position.userId,
      configId: position.configId,
      token: position.tokenSymbol || position.tokenAddress,
      chainId: position.chainId,
      targetSellTxHash: historicalIntent.targetSellTxHash || null,
      reasonCode: historicalIntent.reasonCode,
    });
  } else {
    logger.info(LogCode.SYS_INFO, 'Historical target sell ghost position found existing exit work', {
      positionId: position.id,
      userId: position.userId,
      configId: position.configId,
      token: position.tokenSymbol || position.tokenAddress,
      chainId: position.chainId,
      targetSellTxHash: historicalIntent.targetSellTxHash || null,
      reasonCode: historicalIntent.reasonCode,
      releaseOutcome: releaseResult.outcome,
    });
  }

  return {
    repaired: true,
    targetSellTxHash: historicalIntent.targetSellTxHash || null,
    reasonCode: historicalIntent.reasonCode,
  };
}
