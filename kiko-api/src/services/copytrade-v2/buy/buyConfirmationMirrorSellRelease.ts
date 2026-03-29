import {
  buildTargetSellEventPayload,
  persistTargetSellEventAndSchedulePositions,
  schedulePositionExitIntent,
} from '../exit/positionExitIntentScheduler.js';
import { upsertTargetSellEvent } from '../exit/targetSellEventStore.js';
import { armPendingAttributedPositionsForMirrorSell } from '../positions/pendingAttributedPositionLedger.js';
import type { MirrorSellIntentDisposition } from '../positions/mirrorSellIntentPolicy.js';

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
  reasonCode?: string | null;
  disposition: Exclude<MirrorSellIntentDisposition, 'none'>;
  deps?: {
    buildTargetSellEventPayload?: typeof buildTargetSellEventPayload;
    persistTargetSellEventAndSchedulePositions?: typeof persistTargetSellEventAndSchedulePositions;
    schedulePositionExitIntent?: typeof schedulePositionExitIntent;
    upsertTargetSellEvent?: typeof upsertTargetSellEvent;
    armPendingAttributedPositionsForMirrorSell?: typeof armPendingAttributedPositionsForMirrorSell;
  };
}): Promise<boolean> {
  const position = params.position;
  const buildEventPayload = params.deps?.buildTargetSellEventPayload || buildTargetSellEventPayload;
  const persistTargetSell = params.deps?.persistTargetSellEventAndSchedulePositions || persistTargetSellEventAndSchedulePositions;
  const scheduleExitIntent = params.deps?.schedulePositionExitIntent || schedulePositionExitIntent;
  const upsertSellEvent = params.deps?.upsertTargetSellEvent || upsertTargetSellEvent;
  const armPendingPosition = params.deps?.armPendingAttributedPositionsForMirrorSell || armPendingAttributedPositionsForMirrorSell;
  if (!position || String(position.status || '').toLowerCase() === 'closed') {
    return false;
  }

  const targetSellTxHash = String(params.targetSellTxHash || '').trim();
  if (params.disposition === 'arm_exit') {
    if (targetSellTxHash) {
      await upsertSellEvent(buildEventPayload({
        chainId: params.chainId,
        targetWallet: params.targetWallet,
        tokenAddress: params.tokenAddress,
        targetSellTxHash,
        source: 'buy_confirmation',
        metadata: {
          sourceRuntime: 'legacy_buy_confirmation_release',
          releaseReasonCode: params.reasonCode || null,
          releaseDisposition: params.disposition,
        },
      })).catch(() => null);
    }
    await armPendingPosition({
      userId: position.userId,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      positionIds: [position.id],
      targetSellTxHash: targetSellTxHash || undefined,
      reasonCode: params.reasonCode || 'target_sell_seen_in_history_unverified',
    }).catch(() => 0);
    return true;
  }

  if (!targetSellTxHash) {
    return scheduleExitIntent({
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
        sourceRuntime: 'legacy_buy_confirmation_release',
        releaseReasonCode: params.reasonCode || null,
        releaseDisposition: params.disposition,
        targetWallet: params.targetWallet,
      },
    });
  }

  const scheduled = await persistTargetSell({
    event: buildEventPayload({
      chainId: params.chainId,
      targetWallet: params.targetWallet,
      tokenAddress: params.tokenAddress,
      targetSellTxHash,
      source: 'buy_confirmation',
      metadata: {
        sourceRuntime: 'legacy_buy_confirmation_release',
        releaseReasonCode: params.reasonCode || null,
        releaseDisposition: params.disposition,
      },
    }),
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
      sourceRuntime: 'legacy_buy_confirmation_release',
      releaseReasonCode: params.reasonCode || null,
      releaseDisposition: params.disposition,
    },
  });

  return scheduled.scheduled > 0 || scheduled.skipped > 0;
}
