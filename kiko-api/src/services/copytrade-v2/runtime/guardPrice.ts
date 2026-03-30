import { cacheHub } from '../../../cache/DataCacheHub.js';
import { getTokenInfo } from '../../tokenService.js';
import type { RpcCallProfile } from '../../rpc/profile.js';
import { getDexPriceDetailed } from '../../dexPriceService.js';
import { getTokenMetadata } from '../../rpcService.js';

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

type GuardPriceDeps = {
  getTokenPriceSnapshot?: typeof cacheHub.getTokenPriceSnapshot;
  getTokenInfo?: typeof getTokenInfo;
  getDexPriceDetailed?: typeof getDexPriceDetailed;
  getTokenMetadata?: typeof getTokenMetadata;
};

function resolveGuardPriceLane(
  rpcStrategy: 'cheap' | 'fast' | Readonly<RpcCallProfile> | undefined,
  priority: 'normal' | 'high' | undefined,
): 'cheap' | 'critical' {
  if (rpcStrategy === 'cheap') return 'cheap';
  if (rpcStrategy === 'fast') return 'critical';
  return priority === 'normal' ? 'cheap' : 'critical';
}

export async function getGuardPriceSnapshot(
  tokenAddress: string,
  chainId: number,
  options: {
    priority?: 'normal' | 'high';
    rpcStrategy?: 'cheap' | 'fast' | Readonly<RpcCallProfile>;
    deps?: GuardPriceDeps;
  } = {}
): Promise<GuardPriceSnapshot | null> {
  const getTokenPriceSnapshot = options.deps?.getTokenPriceSnapshot || cacheHub.getTokenPriceSnapshot.bind(cacheHub);
  const fetchTokenInfo = options.deps?.getTokenInfo || getTokenInfo;
  const fetchDexPriceDetailed = options.deps?.getDexPriceDetailed || getDexPriceDetailed;
  const fetchTokenMetadata = options.deps?.getTokenMetadata || getTokenMetadata;

  const shared = getTokenPriceSnapshot(tokenAddress, chainId);
  if (shared) {
    return shared;
  }

  const info = await fetchTokenInfo(tokenAddress, chainId, {
    priority: options.priority ?? 'high',
    rpcStrategy: options.rpcStrategy ?? 'fast',
  });
  if (info && Number.isFinite(info.price) && info.price > 0) {
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

  const fallbackPrice = await fetchDexPriceDetailed(tokenAddress, chainId, {
    lane: resolveGuardPriceLane(options.rpcStrategy, options.priority),
    allowExternalMonitorFallback: true,
  }).catch(() => ({ price: 0, provider: 'unavailable' as const }));
  if (!(Number.isFinite(fallbackPrice.price) && fallbackPrice.price > 0)) {
    return null;
  }

  const metadata = await fetchTokenMetadata(chainId, tokenAddress, {
    rpcStrategy: typeof options.rpcStrategy === 'string' ? options.rpcStrategy : 'fast',
  }).catch(() => null);

  return {
    price: Number(fallbackPrice.price),
    provider: String(fallbackPrice.provider || ''),
    symbol: metadata?.symbol ? String(metadata.symbol) : undefined,
    decimals: Number.isFinite(Number(metadata?.decimals)) ? Number(metadata?.decimals) : undefined,
    priceValidationReason: null,
    referencePrice: null,
    referenceProvider: null,
    priceFallbackUsed: true,
  };
}
