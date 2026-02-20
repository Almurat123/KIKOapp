import type { PoolInfo } from './poolInfo.js';
import type { SelectedV4Pool } from './v4ExecutionPlan.js';

export type DexFamily = 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
export type StrategyKind = 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity' | 'zora-sdk' | 'virtual-bridge';

export interface DexStrategy {
    kind: StrategyKind;
    dex?: DexFamily;
}

export type HintedSourcePool =
    | { kind: 'v4'; pool: SelectedV4Pool; dex: 'uniswap' | 'pancake' }
    | { kind: 'v3'; pool: PoolInfo; dex: 'uniswap' | 'pancake' }
    | { kind: 'v2'; pool: PoolInfo; dex: DexFamily };

export interface DirectSwapRouteHop {
    kind: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';
    dex?: DexFamily;
    poolAddress?: string;
    tokenIn?: string;
    tokenOut?: string;
    fee?: number;
}

export interface DirectSwapHint {
    sourceDexName?: string;
    sourceRouter?: string;
    sourceTxHash?: string;
    routeHopCount?: number;
    routeHops?: DirectSwapRouteHop[];
    canUseResolvedPoolFastPath?: boolean;
    resolvedPoolHint?: {
        kind: 'v4' | 'v3' | 'v2' | 'aerodrome';
        dex?: DexFamily;
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
    };
    preferredStrategy?: StrategyKind;
    preferredDex?: DexFamily;
    bypassReferencePrice?: boolean;
}

// Backward-compatible re-exports for modules still importing from directSwapTypes.
export type {
    DirectSwapExecutionMode,
    DirectSwapResult,
    DirectSwapTraceState,
    LiquidityLayerStatus,
    PoolDiscoveryResult,
    ReferenceQuoteContext,
    ReferenceQuoteDiagnostics,
    TokenLiquidity
} from './directSwap/types.js';
