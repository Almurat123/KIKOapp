import {
  buildTargetSellEventPayload,
  persistTargetSellEventAndSchedulePositions,
  schedulePositionExitIntent,
} from '../exit/positionExitIntentScheduler.js';

export async function releaseMirrorSellAfterBuyConfirm(params: {
  position: {
    id: string;
    status?: string | null;
    userId: string;
    configId: string;
    chainId: number;
    tokenAddress: string;
    entryAmountExact?: string | null;
    entryAmountDec?: string | number | { toString(): string } | null;
  } | null;
  chainId: number;
  tokenAddress: string;
  targetWallet: string;
  targetSellTxHash?: string | null;
  reasonCode?: string | null;
  deps?: {
    buildTargetSellEventPayload?: typeof buildTargetSellEventPayload;
    persistTargetSellEventAndSchedulePositions?: typeof persistTargetSellEventAndSchedulePositions;
    schedulePositionExitIntent?: typeof schedulePositionExitIntent;
  };
}): Promise<boolean> {
  const position = params.position;
  const buildEventPayload = params.deps?.buildTargetSellEventPayload || buildTargetSellEventPayload;
  const persistTargetSell = params.deps?.persistTargetSellEventAndSchedulePositions || persistTargetSellEventAndSchedulePositions;
  const scheduleExitIntent = params.deps?.schedulePositionExitIntent || schedulePositionExitIntent;
  if (!position || String(position.status || '').toLowerCase() === 'closed') {
    return false;
  }

  const targetSellTxHash = String(params.targetSellTxHash || '').trim();
  if (!targetSellTxHash) {
    return scheduleExitIntent({
      position: {
        id: position.id,
        userId: position.userId,
        configId: position.configId,
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
      },
      exitReason: 'mirror_sell',
      priority: 230,
      metadata: {
        sourceRuntime: 'legacy_buy_confirmation_release',
        releaseReasonCode: params.reasonCode || null,
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
      },
    }),
    positions: [{
      id: position.id,
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
    },
  });

  return scheduled.scheduled > 0 || scheduled.skipped > 0;
}
