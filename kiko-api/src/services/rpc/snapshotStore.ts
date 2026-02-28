import {
  buildScopedCacheKey,
  getScopedCacheValue,
  setScopedCacheValue,
  withScopedCache
} from './cacheStore.js';

const BALANCE_TTL_MS = Math.max(250, Number(process.env.RPC_BALANCE_SNAPSHOT_TTL_MS || '1200'));
const ALLOWANCE_TTL_MS = Math.max(250, Number(process.env.RPC_ALLOWANCE_SNAPSHOT_TTL_MS || '1500'));
const ROUTE_READ_TTL_MS = Math.max(150, Number(process.env.RPC_ROUTE_SNAPSHOT_TTL_MS || '800'));

function normalizeBlockTag(blockTag: string | number): string {
  return typeof blockTag === 'number' ? `0x${blockTag.toString(16)}` : String(blockTag || 'latest');
}

export function getNativeBalanceSnapshot(chainId: number, walletAddress: string, blockTag: string | number = 'latest'): string | null {
  return getScopedCacheValue<string>(buildScopedCacheKey('native_balance', [chainId, walletAddress.toLowerCase(), normalizeBlockTag(blockTag)]));
}

export function setNativeBalanceSnapshot(chainId: number, walletAddress: string, blockTag: string | number, value: string, ttlMs = BALANCE_TTL_MS): string {
  return setScopedCacheValue(
    buildScopedCacheKey('native_balance', [chainId, walletAddress.toLowerCase(), normalizeBlockTag(blockTag)]),
    value,
    ttlMs
  );
}

export function getErc20BalanceSnapshot(chainId: number, tokenAddress: string, ownerAddress: string, blockTag: string | number = 'latest'): bigint | null {
  return getScopedCacheValue<bigint>(
    buildScopedCacheKey('erc20_balance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), normalizeBlockTag(blockTag)])
  );
}

export function setErc20BalanceSnapshot(chainId: number, tokenAddress: string, ownerAddress: string, blockTag: string | number, value: bigint, ttlMs = BALANCE_TTL_MS): bigint {
  return setScopedCacheValue(
    buildScopedCacheKey('erc20_balance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), normalizeBlockTag(blockTag)]),
    value,
    ttlMs
  );
}

export function getErc20AllowanceSnapshot(chainId: number, tokenAddress: string, ownerAddress: string, spenderAddress: string, blockTag: string | number = 'latest'): bigint | null {
  return getScopedCacheValue<bigint>(
    buildScopedCacheKey('erc20_allowance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), spenderAddress.toLowerCase(), normalizeBlockTag(blockTag)])
  );
}

export function setErc20AllowanceSnapshot(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  blockTag: string | number,
  value: bigint,
  ttlMs = ALLOWANCE_TTL_MS
): bigint {
  return setScopedCacheValue(
    buildScopedCacheKey('erc20_allowance', [chainId, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), spenderAddress.toLowerCase(), normalizeBlockTag(blockTag)]),
    value,
    ttlMs
  );
}

export async function withRouteReadSnapshot<T>(params: {
  chainId: number;
  method: string;
  keyParts: unknown[];
  ttlMs?: number;
  producer: () => Promise<T>;
}): Promise<T> {
  return await withScopedCache({
    key: buildScopedCacheKey('route_read', [params.chainId, params.method, ...params.keyParts]),
    ttlMs: params.ttlMs ?? ROUTE_READ_TTL_MS,
    producer: params.producer
  });
}
