import type { PoolInfo } from '../poolInfo.js';
import { getV2PoolInfo, getV3PoolInfo } from '../poolInfo.js';
import { createTimedCache } from './cache.js';

const SNAPSHOT_TTL_MS = Number(process.env.DIRECT_SWAP_POOL_SNAPSHOT_TTL_MS || '8000');
const snapshotCache = createTimedCache<PoolInfo>();

function snapshotKey(chainId: number, poolAddress: string, version?: string): string {
  return `${chainId}:${String(version || 'unknown')}:${poolAddress.toLowerCase()}`;
}

function scorePool(pool: PoolInfo): bigint {
  if (pool.version === 'v2' || pool.version === 'aerodrome') {
    return BigInt(pool.reserve0 || '0') + BigInt(pool.reserve1 || '0');
  }
  return BigInt(pool.liquidity || '0');
}

async function refreshPoolSnapshot(pool: PoolInfo, chainId: number): Promise<PoolInfo> {
  const key = snapshotKey(chainId, pool.poolAddress, pool.version);
  const cached = snapshotCache.get(key, SNAPSHOT_TTL_MS);
  if (cached) return cached;

  let refreshed: PoolInfo | null = null;
  if (pool.version === 'v2' || pool.version === 'aerodrome') {
    refreshed = await getV2PoolInfo(pool.poolAddress, chainId).catch(() => null);
  } else if (pool.version === 'v3') {
    refreshed = await getV3PoolInfo(pool.poolAddress, chainId).catch(() => null);
  }

  const merged = refreshed
    ? { ...pool, ...refreshed, dex: pool.dex || refreshed.dex, version: pool.version || refreshed.version }
    : pool;
  snapshotCache.set(key, merged);
  return merged;
}

export async function pickBestPoolByLiveSnapshot(params: {
  pools: PoolInfo[];
  version: PoolInfo['version'];
  chainId: number;
  dex?: string;
}): Promise<PoolInfo | null> {
  const { pools, version, chainId, dex } = params;
  const candidates = pools.filter((p) => p.version === version && (!dex || p.dex === dex));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Keep RPC cost bounded: refresh highest-liquidity/reserve candidates first.
  const seedSorted = [...candidates].sort((a, b) => (scorePool(b) > scorePool(a) ? 1 : -1));
  const toRefresh = seedSorted.slice(0, Math.min(4, seedSorted.length));
  const refreshed = await Promise.all(toRefresh.map((pool) => refreshPoolSnapshot(pool, chainId)));

  const refreshedByAddress = new Map(refreshed.map((p) => [p.poolAddress.toLowerCase(), p]));
  const mergedCandidates = seedSorted.map((pool) => refreshedByAddress.get(pool.poolAddress.toLowerCase()) || pool);

  return mergedCandidates.sort((a, b) => (scorePool(b) > scorePool(a) ? 1 : -1))[0];
}
