import type { TxEvidenceSnapshot } from './types.js';

const byTxHash = new Map<string, TxEvidenceSnapshot>();
const byOrderId = new Map<string, string>();

function txKey(chainId: number, txHash: string): string {
  return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

export function getSnapshotByTxHash(chainId: number, txHash?: string | null): TxEvidenceSnapshot | null {
  if (!txHash) return null;
  return byTxHash.get(txKey(chainId, txHash)) || null;
}

export function getSnapshotByOrderId(orderId?: string | null): TxEvidenceSnapshot | null {
  if (!orderId) return null;
  const key = byOrderId.get(orderId);
  if (!key) return null;
  return byTxHash.get(key) || null;
}

export function upsertSnapshot(snapshot: TxEvidenceSnapshot): TxEvidenceSnapshot {
  const canonical = snapshot.canonicalTxHash || snapshot.allTxHashes[0] || '';
  if (!canonical) return snapshot;
  const key = txKey(snapshot.chainId, canonical);
  byTxHash.set(key, snapshot);
  if (snapshot.orderId) byOrderId.set(snapshot.orderId, key);
  return snapshot;
}

export function bindOrderId(orderId: string | undefined, chainId: number, txHash?: string | null): void {
  if (!orderId || !txHash) return;
  byOrderId.set(orderId, txKey(chainId, txHash));
}
