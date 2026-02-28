import type { AdjudicatedTxState, TxEvidenceSnapshot } from './types.js';

function nextState(snapshot: TxEvidenceSnapshot): { state: AdjudicatedTxState; reasonCode: string; final: boolean } {
  if (snapshot.receipt.seen) {
    if (snapshot.receipt.success === true) return { state: 'confirmed_success', reasonCode: 'receipt_success', final: true };
    if (snapshot.receipt.success === false) return { state: 'confirmed_failed', reasonCode: 'receipt_failed', final: true };
  }
  if (snapshot.webhook.seen) {
    return { state: 'chain_observed', reasonCode: 'webhook_seen', final: false };
  }
  if (snapshot.txByHash.seen) {
    return { state: 'rpc_visible', reasonCode: 'tx_by_hash_seen', final: false };
  }
  if (snapshot.send.accepted) {
    return { state: 'send_accepted', reasonCode: 'send_accepted', final: false };
  }
  const rpcError = snapshot.receipt.rpcError || snapshot.txByHash.rpcError;
  if (rpcError) {
    return { state: 'rpc_uncertain', reasonCode: 'rpc_uncertain', final: false };
  }
  return { state: 'unknown', reasonCode: 'none', final: false };
}

export function adjudicateSnapshot(snapshot: TxEvidenceSnapshot): TxEvidenceSnapshot {
  const adjudicated = nextState(snapshot);
  return {
    ...snapshot,
    adjudicated: {
      ...adjudicated,
      decidedAt: Date.now()
    }
  };
}
