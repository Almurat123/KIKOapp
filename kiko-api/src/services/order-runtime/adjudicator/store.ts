import type { TxEvidenceSnapshot } from './types.js';
import { mergeTxHashAliases, normalizeTxHash } from '../../rpc/confirmEvidence.js';

const byTxHash = new Map<string, TxEvidenceSnapshot>();
const byOrderId = new Map<string, string>();

function txKey(chainId: number, txHash: string): string {
  return `${chainId}:${txHash}`;
}

export function getSnapshotByTxHash(chainId: number, txHash?: string | null): TxEvidenceSnapshot | null {
  const normalized = normalizeTxHash(chainId, txHash);
  if (!normalized) return null;
  return byTxHash.get(txKey(chainId, normalized)) || null;
}

export function getSnapshotByOrderId(orderId?: string | null): TxEvidenceSnapshot | null {
  if (!orderId) return null;
  const key = byOrderId.get(orderId);
  if (!key) return null;
  return byTxHash.get(key) || null;
}

export function upsertSnapshot(snapshot: TxEvidenceSnapshot): TxEvidenceSnapshot {
  snapshot.allTxHashes = mergeTxHashAliases(snapshot.chainId, snapshot.allTxHashes || [], [snapshot.canonicalTxHash]);
  const canonical = normalizeTxHash(snapshot.chainId, snapshot.canonicalTxHash) || snapshot.allTxHashes[0] || '';
  if (!canonical) return snapshot;
  snapshot.canonicalTxHash = canonical;
  const aliases = mergeTxHashAliases(snapshot.chainId, snapshot.allTxHashes, [canonical]);
  for (const alias of aliases) {
    byTxHash.set(txKey(snapshot.chainId, alias), snapshot);
  }
  if (snapshot.orderId) byOrderId.set(snapshot.orderId, txKey(snapshot.chainId, canonical));
  return snapshot;
}

export function bindOrderId(orderId: string | undefined, chainId: number, txHash?: string | null): void {
  const normalized = normalizeTxHash(chainId, txHash);
  if (!orderId || !normalized) return;
  byOrderId.set(orderId, txKey(chainId, normalized));
}
