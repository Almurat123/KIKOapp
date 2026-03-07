import { Connection, type Commitment } from '@solana/web3.js';
import { getCachedAuthTokenSnapshot } from './authToken';

const DEFAULT_RPC_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/rpc/solana`;
const DEFAULT_COMMITMENT: Commitment = 'confirmed';
const CONNECTION_CACHE_TTL_MS = 60_000;
const MAX_CONNECTION_CACHE_SIZE = 8;

const connectionCache = new Map<string, { connection: Connection; timestamp: number }>();

function cacheKey(url: string, commitment: Commitment): string {
  return `${url}::${commitment}`;
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, row] of connectionCache.entries()) {
    if (now - row.timestamp > CONNECTION_CACHE_TTL_MS) {
      connectionCache.delete(key);
    }
  }
  if (connectionCache.size <= MAX_CONNECTION_CACHE_SIZE) return;
  const keys = Array.from(connectionCache.keys());
  const overflow = connectionCache.size - MAX_CONNECTION_CACHE_SIZE;
  for (let i = 0; i < overflow; i += 1) {
    connectionCache.delete(keys[i]);
  }
}

export function getSolanaRpcUrl(): string {
  return DEFAULT_RPC_URL;
}

export function getSolanaRpcConnection(options?: {
  url?: string;
  commitment?: Commitment;
}): Connection {
  const url = options?.url || DEFAULT_RPC_URL;
  const commitment = options?.commitment || DEFAULT_COMMITMENT;
  const key = cacheKey(url, commitment);
  const cached = connectionCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < CONNECTION_CACHE_TTL_MS) {
    return cached.connection;
  }

  const authToken = getCachedAuthTokenSnapshot();
  const connection = new Connection(url, {
    commitment,
    httpHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
  connectionCache.set(key, { connection, timestamp: now });
  pruneCache();
  return connection;
}
