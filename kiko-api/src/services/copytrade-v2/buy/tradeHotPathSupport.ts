import type { OnChainMetadata } from '../../rpcService.js';
import type { RpcCallProfile } from '../../rpc/profile.js';

export type SingleUserBuyOutcome = 'executed' | 'pending' | 'skipped' | 'failed';

export type SingleUserBuyResult = {
  outcome: SingleUserBuyOutcome;
};

export function summarizeSingleUserBuyResults(results: PromiseSettledResult<SingleUserBuyResult>[]) {
  let confirmed = 0;
  let awaitingVisibility = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'rejected') {
      failed++;
      continue;
    }
    if (result.value.outcome === 'executed') confirmed++;
    else if (result.value.outcome === 'pending') awaitingVisibility++;
    else if (result.value.outcome === 'skipped') skipped++;
    else failed++;
  }

  return {
    confirmed,
    awaitingVisibility,
    submitted: confirmed + awaitingVisibility,
    executed: confirmed,
    pending: awaitingVisibility,
    skipped,
    failed,
  };
}

function buildFallbackTokenInfo(
  tokenAddress: string,
  metadata: OnChainMetadata | null | undefined,
  provider: string
) {
  return {
    price: 0,
    symbol: metadata?.symbol || 'UNKNOWN',
    name: metadata?.name || 'Unknown Token',
    decimals: metadata?.decimals || 18,
    liquidity: 0,
    volume24h: 0,
    fdv: 0,
    marketCap: 0,
    pairCreatedAt: Date.now(),
    socials: [],
    websites: [],
    provider,
  };
}

export async function resolveTurboMetadataFallbackInfo(params: {
  tokenAddress: string;
  metadataPromise: Promise<OnChainMetadata | null>;
  timeoutMs: number;
  metadataProfile: RpcCallProfile;
  getTokenDecimals: (
    chainId: number,
    address: string,
    options?: { rpcStrategy?: 'fast' | 'cheap'; defaultDecimals?: number; profile?: RpcCallProfile }
  ) => Promise<number>;
  chainId: number;
}): Promise<{ tokenInfo: ReturnType<typeof buildFallbackTokenInfo>; metadataTimedOut: boolean }> {
  const timeoutMs = Math.max(50, params.timeoutMs);
  const timedMetadata = await Promise.race<OnChainMetadata | null | undefined>([
    params.metadataPromise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
  ]);

  if (timedMetadata) {
    return {
      tokenInfo: buildFallbackTokenInfo(params.tokenAddress, timedMetadata, 'rpc-metadata'),
      metadataTimedOut: false,
    };
  }

  const decimals = await params.getTokenDecimals(params.chainId, params.tokenAddress, {
    defaultDecimals: 18,
    profile: params.metadataProfile,
  }).catch(() => 18);

  return {
    tokenInfo: buildFallbackTokenInfo(
      params.tokenAddress,
      { name: 'Unknown Token', symbol: 'UNKNOWN', decimals },
      'rpc-metadata-timeout'
    ),
    metadataTimedOut: true,
  };
}

export function scheduleAsyncMarketCapHydration(params: {
  chainId: number;
  tokenAddress: string;
  impliedPrice: number;
  decimals: number;
  getTokenSupply: (
    chainId: number,
    address: string,
    options?: { rpcStrategy?: 'fast' | 'cheap'; defaultDecimals?: number; profile?: RpcCallProfile }
  ) => Promise<number>;
  profile: RpcCallProfile;
  onResolved: (marketCap: number, totalSupply: number) => void;
  onError?: (error: unknown) => void;
}): void {
  void params.getTokenSupply(params.chainId, params.tokenAddress, {
    defaultDecimals: params.decimals,
    profile: params.profile,
  }).then((totalSupply) => {
    if (!Number.isFinite(totalSupply) || totalSupply <= 0) return;
    params.onResolved(totalSupply * params.impliedPrice, totalSupply);
  }).catch((error) => {
    params.onError?.(error);
  });
}
