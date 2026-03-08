import {
  buildCopyTradeFirstSeenTiming,
  markCopyTradeSwapReady,
  markCopyTradeTaskEnqueued,
  mergeCopyTradeTimingSnapshots,
  type CopyTradeTimingSnapshot,
} from './copyTradeTimingModel.js';

export type WebhookSwapTimingSource = 'webhook_cached_predecoded' | 'webhook_decode';

export function buildWebhookDecodeReadyTiming(params: {
  swapSource: WebhookSwapTimingSource;
  cachedTiming?: CopyTradeTimingSnapshot;
  pendingHintTiming?: CopyTradeTimingSnapshot;
  nowMs?: number;
}): CopyTradeTimingSnapshot {
  const nowMs = params.nowMs ?? Date.now();
  if (params.swapSource === 'webhook_cached_predecoded' && params.cachedTiming) {
    return markCopyTradeSwapReady(
      mergeCopyTradeTimingSnapshots(params.cachedTiming, params.pendingHintTiming),
      nowMs,
      'webhook_cached_predecoded'
    );
  }

  return markCopyTradeSwapReady(
    buildCopyTradeFirstSeenTiming(nowMs, 'webhook_decode'),
    nowMs,
    'webhook_decode'
  );
}

export function buildWebhookDecodeDispatchTiming(params: {
  swapSource: WebhookSwapTimingSource;
  cachedTiming?: CopyTradeTimingSnapshot;
  pendingHintTiming?: CopyTradeTimingSnapshot;
  nowMs?: number;
}): CopyTradeTimingSnapshot {
  const readyTiming = buildWebhookDecodeReadyTiming(params);
  return markCopyTradeTaskEnqueued(readyTiming, params.nowMs ?? Date.now());
}
