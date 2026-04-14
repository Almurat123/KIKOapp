import {
  buildTargetSellEventPayload,
  persistTargetSellEventAndSchedulePositions,
  schedulePositionExitIntent,
} from '../exit/positionExitIntentScheduler.js';
import { upsertTargetSellEvent } from '../exit/targetSellEventStore.js';
import { armPendingAttributedPositionsForMirrorSell } from '../positions/pendingAttributedPositionLedger.js';
import type { MirrorSellIntentDisposition } from '../positions/mirrorSellIntentPolicy.js';

export type MirrorSellReleaseResult =
  | { outcome: 'scheduled' }
  | { outcome: 'already_active' }
  | { outcome: 'armed_pending' }
  | { outcome: 'no_position' | 'closed_position' | 'not_scheduled' };

// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Avery Lin
// Reason: Historical target-sell evidence can surface after buy-confirm or later from
//         monitor-side orphan recovery, so both owners must share one durable release path.
//         The helper also must distinguish "scheduled new exit work" from "reused existing
//         active intent" so upper layers do not mis-log idempotent reuse as fresh replay.
// Goal: Convert historical mirror-sell evidence into the same persisted event and
//       exit-intent flow used by the live runtime, without leaving silent open positions.
// Owns: Releasing historical target-sell evidence into event store and exit-intent scheduling.
// Does Not Own: Deciding whether historical sell evidence exists, or executing the exit.
// Design Language:
// - Historical replay must go through the same durable event path as live sell webhooks.
// - Preserve target-sell metadata when replaying history.
// - Do not silently mark order state armed without creating or reusing durable exit work.
// - Do not collapse idempotent reuse into the same success shape as newly scheduled exit work.
// Document Provenance:
// - Source: system-journal/fix-log/2026-04-10-buy-confirm-target-sell-replay-gap.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: durable historical target-sell release after buy confirmation
// - Verification: verified in code
// - Source: system-journal/fix-log/2026-04-10-open-position-historical-target-sell-reconciler.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: reusing the same helper for monitor-side orphan repair
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776159582066.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: separating active-intent reuse from true historical replay so ghost logs do not misreport duplicate exit release
// - Verification: verified in runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-buy-confirm-target-sell-replay-gap.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-historical-target-sell-release-result-semantics.md

export async function releaseMirrorSellAfterBuyConfirm(params: {
  position: {
    id: string;
    status?: string | null;
    userId: string;
    configId: string;
    chainId: number;
    tokenAddress: string;
    orderId?: string | null;
    entryAmountExact?: string | null;
    entryAmountDec?: string | number | { toString(): string } | null;
  } | null;
  chainId: number;
  tokenAddress: string;
  targetWallet: string;
  targetSellTxHash?: string | null;
  targetSellRatioBps?: number | null;
  targetFullExitVerified?: boolean;
  targetRemainingBalanceRaw?: string | null;
  reasonCode?: string | null;
  disposition: Exclude<MirrorSellIntentDisposition, 'none'>;
  sourceRuntime?: string;
  deps?: {
    buildTargetSellEventPayload?: typeof buildTargetSellEventPayload;
    persistTargetSellEventAndSchedulePositions?: typeof persistTargetSellEventAndSchedulePositions;
    schedulePositionExitIntent?: typeof schedulePositionExitIntent;
    upsertTargetSellEvent?: typeof upsertTargetSellEvent;
    armPendingAttributedPositionsForMirrorSell?: typeof armPendingAttributedPositionsForMirrorSell;
  };
}): Promise<MirrorSellReleaseResult> {
  const position = params.position;
  const buildEventPayload = params.deps?.buildTargetSellEventPayload || buildTargetSellEventPayload;
  const persistTargetSell = params.deps?.persistTargetSellEventAndSchedulePositions || persistTargetSellEventAndSchedulePositions;
  const scheduleExitIntent = params.deps?.schedulePositionExitIntent || schedulePositionExitIntent;
  const upsertSellEvent = params.deps?.upsertTargetSellEvent || upsertTargetSellEvent;
  const armPendingPosition = params.deps?.armPendingAttributedPositionsForMirrorSell || armPendingAttributedPositionsForMirrorSell;
  if (!position || String(position.status || '').toLowerCase() === 'closed') {
    return { outcome: position ? 'closed_position' : 'no_position' };
  }

  const targetSellTxHash = String(params.targetSellTxHash || '').trim();
  const sourceRuntime = String(params.sourceRuntime || 'legacy_buy_confirmation_release').trim() || 'legacy_buy_confirmation_release';
  const buildReplayEvent = () => buildEventPayload({
    chainId: params.chainId,
    targetWallet: params.targetWallet,
    tokenAddress: params.tokenAddress,
    targetSellTxHash,
    targetSellRatioBps: params.targetSellRatioBps ?? null,
    targetFullExitVerified: params.targetFullExitVerified,
    targetRemainingBalanceRaw: params.targetRemainingBalanceRaw ?? null,
    source: 'buy_confirmation',
    metadata: {
      sourceRuntime,
      releaseReasonCode: params.reasonCode || null,
      releaseDisposition: params.disposition,
    },
  });

  if (params.disposition === 'arm_exit') {
    if (targetSellTxHash) {
      await upsertSellEvent(buildReplayEvent()).catch(() => null);
    }
    const armedCount = await armPendingPosition({
      userId: position.userId,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      positionIds: [position.id],
      targetSellTxHash: targetSellTxHash || undefined,
      reasonCode: params.reasonCode || 'target_sell_seen_in_history_unverified',
    }).catch(() => 0);
    return { outcome: armedCount > 0 ? 'armed_pending' : 'not_scheduled' };
  }

  if (!targetSellTxHash) {
    const scheduled = await scheduleExitIntent({
      position: {
        id: position.id,
        userId: position.userId,
        configId: position.configId,
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
        orderId: position.orderId || null,
      },
      exitReason: 'mirror_sell',
      priority: 230,
      metadata: {
        sourceRuntime,
        releaseReasonCode: params.reasonCode || null,
        releaseDisposition: params.disposition,
        targetWallet: params.targetWallet,
      },
    });
    return { outcome: scheduled ? 'scheduled' : 'not_scheduled' };
  }

  const scheduled = await persistTargetSell({
    // Replay through the durable event scheduler so buy-confirm and live sell webhook
    // produce one canonical exit-intent path.
    event: buildReplayEvent(),
    positions: [{
      id: position.id,
      orderId: position.orderId || null,
      userId: position.userId,
      configId: position.configId,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      entryAmountExact: position.entryAmountExact,
      entryAmountDec: position.entryAmountDec,
    }],
    priority: 230,
    metadata: {
      sourceRuntime,
      releaseReasonCode: params.reasonCode || null,
      releaseDisposition: params.disposition,
    },
  });

  if (scheduled.scheduled > 0) return { outcome: 'scheduled' };
  if (scheduled.skipped > 0) return { outcome: 'already_active' };
  return { outcome: 'not_scheduled' };
}
