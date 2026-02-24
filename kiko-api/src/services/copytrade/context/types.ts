export interface SwapExecutionContextRouteHopV1 {
  kind: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';
  dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
  poolAddress?: string;
  tokenIn?: string;
  tokenOut?: string;
  fee?: number;
}

export interface SwapExecutionContextResolvedPoolHintV1 {
  kind: 'v4' | 'v3' | 'v2' | 'aerodrome';
  dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
  poolAddress?: string;
  fee?: number;
  v4PoolKey?: {
    currency0: string;
    currency1: string;
    hooks: string;
    poolManager: string;
    fee: number;
    tickSpacing: number;
  };
}

export interface SwapExecutionContextV1 {
  version: 1;
  chainId: number;
  sourceTxHash: string;
  sourceRouter?: string;
  sourceSelector?: string;
  sourceTxInput?: string;
  sourceTxValue?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  routeHops?: SwapExecutionContextRouteHopV1[];
  resolvedPoolHint?: SwapExecutionContextResolvedPoolHintV1;
  decodeEvidence: {
    hasSwapTopic: boolean;
    knownRouter: boolean;
    knownSelector: boolean;
  };
  trace: {
    webhookId?: string;
    targetWallet?: string;
    detectedAt: number;
  };
}

export interface ContextStoreHit {
  context: SwapExecutionContextV1 | null;
  source: 'redis' | 'db' | 'inline' | 'miss';
  contextId?: string;
}

