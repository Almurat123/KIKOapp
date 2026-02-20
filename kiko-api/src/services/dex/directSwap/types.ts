import type { DexFamily, DexStrategy, DirectSwapHint, HintedSourcePool, StrategyKind } from '../directSwapTypes.js';

export type { DexFamily, DexStrategy, DirectSwapHint, HintedSourcePool, StrategyKind };

export type DirectSwapExecutionMode = 'safe' | 'normal' | 'turbo';

export type LiquidityLayerStatus = 'ok' | 'missing' | 'skipped' | 'error' | 'unknown';

export interface DirectSwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  error?: string;
  provider:
    | 'uniswap-v2'
    | 'pancake-v2'
    | 'uniswap-v3'
    | 'pancake-v3'
    | 'uniswap-v4'
    | 'pancake-infinity'
    | 'aerodrome'
    | 'zora-sdk'
    | 'failed';
  poolInfo?: {
    version: string;
    fee: number;
    liquidity: string;
  };
}

export interface TokenLiquidity {
  totalTvlUsd: number;
  pools: {
    version: string;
    fee: number;
    tvlUsd: number;
    address: string;
  }[];
}

export interface DirectSwapTraceState {
  traceId: string;
  l1PoolStatus: LiquidityLayerStatus;
  l2RouteStatus: LiquidityLayerStatus;
  l3MarketStatus: LiquidityLayerStatus;
  poolCount: number;
  poolKinds: { v2: number; v3: number; v4: number };
  referenceSource: string;
  failureCode?: string;
}

export interface ReferenceQuoteDiagnostics {
  source: string;
  l2Status: LiquidityLayerStatus;
  l3Status: LiquidityLayerStatus;
}

export interface DirectSwapExecuteParams {
  userId: string;
  accessToken: string;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainId: number;
  slippageBps: number;
  hint?: DirectSwapHint;
  executionMode?: 'safe' | 'normal' | 'turbo';
  _externalRetryAttempt?: number;
}

export interface ReferenceQuoteContext {
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  chainId: number;
  recipient?: string;
  cacheOnly?: boolean;
  enableZoraRoutes?: boolean;
}

export interface PoolDiscoveryResult {
  poolsFound: number;
  poolKinds: {
    v2: number;
    v3: number;
    v4: number;
  };
}
