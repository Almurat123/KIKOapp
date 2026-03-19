import { cacheHub } from '../../../cache/DataCacheHub.js';
import { getTokenInfo } from '../../tokenService.js';
import type { RpcCallProfile } from '../../rpc/profile.js';

export type GuardPriceSnapshot = {
  price: number;
  provider: string;
  symbol?: string;
  decimals?: number;
  priceValidationReason?: string | null;
  referencePrice?: number | null;
  referenceProvider?: string | null;
  priceFallbackUsed?: boolean;
};

export async function getGuardPriceSnapshot(
  tokenAddress: string,
  chainId: number,
  options: {
    priority?: 'normal' | 'high';
    rpcStrategy?: 'cheap' | 'fast' | Readonly<RpcCallProfile>;
  } = {}
): Promise<GuardPriceSnapshot | null> {
  const shared = cacheHub.getTokenPriceSnapshot(tokenAddress, chainId);
  if (shared) {
    return shared;
  }

  const info = await getTokenInfo(tokenAddress, chainId, {
    priority: options.priority ?? 'high',
    rpcStrategy: options.rpcStrategy ?? 'fast',
  });
  if (!(info && Number.isFinite(info.price) && info.price > 0)) {
    return null;
  }

  return {
    price: Number(info.price),
    provider: String(info.provider || ''),
    symbol: info.symbol ? String(info.symbol) : undefined,
    decimals: Number.isFinite(Number(info.decimals)) ? Number(info.decimals) : undefined,
    priceValidationReason: info.priceValidationReason ?? null,
    referencePrice: Number.isFinite(Number(info.referencePrice)) ? Number(info.referencePrice) : null,
    referenceProvider: info.referenceProvider ?? null,
    priceFallbackUsed: Boolean(info.priceFallbackUsed),
  };
}
