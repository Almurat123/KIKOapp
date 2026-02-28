import { adjudicateSnapshot } from './rules.js';
import { bindOrderId, getSnapshotByOrderId, getSnapshotByTxHash, upsertSnapshot } from './store.js';
import type { TxEvidenceSnapshot, TxEvidenceSource } from './types.js';

function createEmptySnapshot(chainId: number, txHash?: string | null, orderId?: string): TxEvidenceSnapshot {
  const canonicalTxHash = txHash ? String(txHash).toLowerCase() : undefined;
  return {
    orderId,
    chainId,
    canonicalTxHash,
    allTxHashes: canonicalTxHash ? [canonicalTxHash] : [],
    send: { accepted: false },
    txByHash: { seen: false },
    receipt: { seen: false },
    webhook: { seen: false },
    adjudicated: {
      state: 'unknown',
      reasonCode: 'none',
      decidedAt: Date.now(),
      final: false
    }
  };
}

function getOrCreate(params: { chainId: number; txHash?: string | null; orderId?: string }): TxEvidenceSnapshot {
  const existing = (params.orderId ? getSnapshotByOrderId(params.orderId) : null)
    || (params.txHash ? getSnapshotByTxHash(params.chainId, params.txHash) : null);
  if (existing) return existing;
  return createEmptySnapshot(params.chainId, params.txHash, params.orderId);
}

function normalizeAndStore(snapshot: TxEvidenceSnapshot): TxEvidenceSnapshot {
  const canonical = snapshot.canonicalTxHash || snapshot.allTxHashes[0];
  if (canonical) {
    snapshot.canonicalTxHash = canonical.toLowerCase();
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) {
      snapshot.allTxHashes.unshift(snapshot.canonicalTxHash);
    }
  }
  const adjudicated = adjudicateSnapshot(snapshot);
  return upsertSnapshot(adjudicated);
}

export function reportSendAccepted(params: {
  chainId: number;
  txHash: string;
  orderId?: string;
  source?: TxEvidenceSource;
}): TxEvidenceSnapshot {
  const snapshot = getOrCreate(params);
  snapshot.orderId = snapshot.orderId || params.orderId;
  snapshot.canonicalTxHash = String(params.txHash).toLowerCase();
  if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) snapshot.allTxHashes.push(snapshot.canonicalTxHash);
  snapshot.send = {
    accepted: true,
    source: params.source || 'unknown',
    acceptedAt: snapshot.send.acceptedAt || Date.now()
  };
  bindOrderId(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
  return normalizeAndStore(snapshot);
}

export function reportTxByHashSeen(params: {
  chainId: number;
  txHash: string;
  orderId?: string;
  from?: string | null;
  blockNumber?: string | null;
  rpcError?: string;
  source?: TxEvidenceSource;
}): TxEvidenceSnapshot {
  const snapshot = getOrCreate(params);
  snapshot.orderId = snapshot.orderId || params.orderId;
  snapshot.canonicalTxHash = snapshot.canonicalTxHash || String(params.txHash).toLowerCase();
  if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) snapshot.allTxHashes.push(snapshot.canonicalTxHash);
  snapshot.txByHash = {
    seen: true,
    from: params.from || snapshot.txByHash.from,
    blockNumber: params.blockNumber || snapshot.txByHash.blockNumber,
    seenAt: snapshot.txByHash.seenAt || Date.now(),
    source: params.source || 'rpc_tx',
    rpcError: params.rpcError || snapshot.txByHash.rpcError
  };
  bindOrderId(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
  return normalizeAndStore(snapshot);
}

export function reportReceiptSeen(params: {
  chainId: number;
  txHash: string;
  orderId?: string;
  success: boolean;
  blockNumber?: string | null;
  rpcError?: string;
  source?: TxEvidenceSource;
}): TxEvidenceSnapshot {
  const snapshot = getOrCreate(params);
  snapshot.orderId = snapshot.orderId || params.orderId;
  snapshot.canonicalTxHash = snapshot.canonicalTxHash || String(params.txHash).toLowerCase();
  if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) snapshot.allTxHashes.push(snapshot.canonicalTxHash);
  snapshot.receipt = {
    seen: true,
    success: params.success,
    blockNumber: params.blockNumber || snapshot.receipt.blockNumber,
    seenAt: snapshot.receipt.seenAt || Date.now(),
    source: params.source || 'rpc_receipt',
    rpcError: params.rpcError || snapshot.receipt.rpcError
  };
  bindOrderId(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
  return normalizeAndStore(snapshot);
}

export function reportWebhookSeen(params: {
  chainId: number;
  txHash: string;
  orderId?: string;
  source?: TxEvidenceSource;
  matchedWallet?: string | null;
}): TxEvidenceSnapshot {
  const snapshot = getOrCreate(params);
  snapshot.orderId = snapshot.orderId || params.orderId;
  snapshot.canonicalTxHash = snapshot.canonicalTxHash || String(params.txHash).toLowerCase();
  if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) snapshot.allTxHashes.push(snapshot.canonicalTxHash);
  snapshot.webhook = {
    seen: true,
    source: params.source || 'alchemy_webhook',
    seenAt: snapshot.webhook.seenAt || Date.now(),
    matchedWallet: params.matchedWallet || snapshot.webhook.matchedWallet
  };
  bindOrderId(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
  return normalizeAndStore(snapshot);
}

export function reportRpcUncertain(params: {
  chainId: number;
  txHash: string;
  orderId?: string;
  error: string;
}): TxEvidenceSnapshot {
  const snapshot = getOrCreate(params);
  snapshot.orderId = snapshot.orderId || params.orderId;
  snapshot.canonicalTxHash = snapshot.canonicalTxHash || String(params.txHash).toLowerCase();
  if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) snapshot.allTxHashes.push(snapshot.canonicalTxHash);
  snapshot.txByHash.rpcError = params.error;
  snapshot.receipt.rpcError = params.error;
  bindOrderId(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
  return normalizeAndStore(snapshot);
}

export function bindOrderToTxHash(orderId: string | undefined, chainId: number, txHash?: string | null): void {
  bindOrderId(orderId, chainId, txHash);
}

export function getAdjudicatedSnapshot(params: { orderId?: string | null; chainId?: number; txHash?: string | null }): TxEvidenceSnapshot | null {
  if (params.orderId) return getSnapshotByOrderId(params.orderId);
  if (params.chainId && params.txHash) return getSnapshotByTxHash(params.chainId, params.txHash);
  return null;
}
