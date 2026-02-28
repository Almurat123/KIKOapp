import type { TxLifecycleResult } from '../txLifecycle.js';
import { buildScopedCacheKey, getScopedCacheValue, setScopedCacheValue, withScopedSingleFlight } from './cacheStore.js';

export interface SharedTxObservation {
  tx: any | null;
  receipt: any | null;
  lastRpcError?: string;
  observedAt: number;
}

const TX_OBSERVATION_TTL_MS = Math.max(150, Number(process.env.RPC_TX_OBSERVATION_TTL_MS || '400'));
const TX_CONFIRM_RESULT_TTL_MS = Math.max(500, Number(process.env.RPC_TX_CONFIRM_RESULT_TTL_MS || '2000'));

function observationKey(chainId: number, txHash: string, scope: string): string {
  return buildScopedCacheKey('tx_observation', [scope, chainId, txHash.toLowerCase()]);
}

function confirmKey(chainId: number, txHash: string): string {
  return buildScopedCacheKey('tx_confirm', [chainId, txHash.toLowerCase()]);
}

export async function getSharedTxObservation(params: {
  chainId: number;
  txHash: string;
  scope?: 'tx' | 'receipt' | 'combined';
  ttlMs?: number;
  producer: () => Promise<SharedTxObservation>;
}): Promise<SharedTxObservation> {
  const key = observationKey(params.chainId, params.txHash, params.scope || 'combined');
  const cached = getScopedCacheValue<SharedTxObservation>(key);
  if (cached) return cached;
  return await withScopedSingleFlight(key, async () => {
    const fresh = await params.producer();
    return setScopedCacheValue(key, fresh, params.ttlMs ?? TX_OBSERVATION_TTL_MS);
  });
}

export async function waitForSharedTxConfirmation(params: {
  chainId: number;
  txHash: string;
  producer: () => Promise<TxLifecycleResult>;
}): Promise<TxLifecycleResult> {
  const key = confirmKey(params.chainId, params.txHash);
  const cached = getScopedCacheValue<TxLifecycleResult>(key);
  if (cached) return cached;
  return await withScopedSingleFlight(key, async () => {
    const out = await params.producer();
    if (
      out.status === 'confirmed_success'
      || out.status === 'confirmed_failed'
      || out.status === 'visible_pending'
      || out.status === 'dropped_timeout'
    ) {
      setScopedCacheValue(key, out, TX_CONFIRM_RESULT_TTL_MS);
    }
    return out;
  });
}
