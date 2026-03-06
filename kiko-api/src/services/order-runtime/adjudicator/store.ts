import { getJson as cacheGetJson, setJson as cacheSetJson } from '../../../cache/cacheClient.js';
import type { TxEvidenceSnapshot } from './types.js';
import { mergeTxHashAliases, normalizeTxHash } from '../../rpc/confirmEvidence.js';

const byTxHash = new Map<string, TxEvidenceSnapshot>();
const byOrderId = new Map<string, string>();
const SNAPSHOT_TTL_SEC = Math.max(60, Number(process.env.COPYTRADE_ADJUDICATOR_SNAPSHOT_TTL_SEC || '900'));

function txKey(chainId: number, txHash: string): string {
  return `${chainId}:${txHash}`;
}

function snapshotCacheKey(chainId: number, txHash: string): string {
  return `copytrade:adjudicator:snapshot:${chainId}:${txHash}`;
}

function orderCacheKey(orderId: string): string {
  return `copytrade:adjudicator:order:${orderId}`;
}

function persistSnapshotToMemory(snapshot: TxEvidenceSnapshot): TxEvidenceSnapshot {
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

async function persistSnapshotToShared(snapshot: TxEvidenceSnapshot): Promise<void> {
  const canonical = normalizeTxHash(snapshot.chainId, snapshot.canonicalTxHash) || snapshot.allTxHashes[0] || '';
  if (!canonical) return;
  const aliases = mergeTxHashAliases(snapshot.chainId, snapshot.allTxHashes, [canonical]);
  await Promise.all([
    ...aliases.map((alias) => cacheSetJson(snapshotCacheKey(snapshot.chainId, alias), snapshot, SNAPSHOT_TTL_SEC).catch(() => { })),
    snapshot.orderId
      ? cacheSetJson(orderCacheKey(snapshot.orderId), { chainId: snapshot.chainId, txHash: canonical }, SNAPSHOT_TTL_SEC).catch(() => { })
      : Promise.resolve(),
  ]);
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
  const persisted = persistSnapshotToMemory(snapshot);
  void persistSnapshotToShared(persisted);
  return persisted;
}

export function bindOrderId(orderId: string | undefined, chainId: number, txHash?: string | null): void {
  const normalized = normalizeTxHash(chainId, txHash);
  if (!orderId || !normalized) return;
  byOrderId.set(orderId, txKey(chainId, normalized));
  void cacheSetJson(orderCacheKey(orderId), { chainId, txHash: normalized }, SNAPSHOT_TTL_SEC).catch(() => { });
}

export async function hydrateSharedSnapshotByTxHash(chainId: number, txHash?: string | null): Promise<TxEvidenceSnapshot | null> {
  const normalized = normalizeTxHash(chainId, txHash);
  if (!normalized) return null;
  const cached = await cacheGetJson<TxEvidenceSnapshot>(snapshotCacheKey(chainId, normalized)).catch(() => null);
  if (!cached) return null;
  return persistSnapshotToMemory(cached);
}

export async function hydrateSharedSnapshotByOrderId(orderId?: string | null): Promise<TxEvidenceSnapshot | null> {
  if (!orderId) return null;
  const pointer = await cacheGetJson<{ chainId: number; txHash: string }>(orderCacheKey(orderId)).catch(() => null);
  if (!pointer?.chainId || !pointer?.txHash) return null;
  return hydrateSharedSnapshotByTxHash(pointer.chainId, pointer.txHash);
}
