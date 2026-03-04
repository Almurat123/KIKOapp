export function resolveCopyTradeQueuePriority(params: {
  chainId: number;
  source?: string | null;
}): number {
  const source = String(params.source || '').toLowerCase();
  if (params.chainId !== 1) {
    return 0;
  }

  if (source.includes('pending_calldata_predecoded')) {
    return 350;
  }
  if (source.includes('pending_prefetch')) {
    return 300;
  }
  if (source.includes('cached_predecoded') || source.includes('process_tx_pending_prefetch')) {
    return 250;
  }
  if (source.includes('receipt_recovery')) {
    return 200;
  }
  if (source.includes('webhook')) {
    return 150;
  }
  return 100;
}
