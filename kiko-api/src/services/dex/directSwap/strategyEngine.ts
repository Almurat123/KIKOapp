/**
 * Direct Swap Service - 直接与 Uniswap V3/V4 池子交互
 * 
 * [Logic]: 绕过 0x/Kyber 聚合器，直接与链上池子交互
 * [Ref]: 仅在 fastSwapMode 时使用
 * 
 * 功能：
 * - 自动检测最佳池子版本 (V3/V4)
 * - 获取代币流动性和市值
 * - 执行直接交易
 */

import { ethers } from 'ethers';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { findTokenPools, PoolInfo } from '../poolInfo.js';
import { findV4Pools, V4PoolInfo, matchV4PoolKeyById } from '../uniswapV4.js';
import { isV4SwapSupported } from '../uniswapV4Swap.js';
import { calculateV3TVL } from '../v3Math.js';
import { callRpc as callRpcBase } from '../../rpcManager.js';
import { sendTransaction, sendTransactionLifecycle } from '../../privyWallet.js';
import { getTokenDetails } from '../../geckoTerminal.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getTokenDecimals, getTokenMetadata } from '../../rpcService.js';
import { del as cacheDel } from '../../../cache/cacheClient.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from '../types.js';
import { buildAerodromeSwapTransaction } from '../aerodrome.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { buildV4HookDataCandidates, isClankerHook, resolveV4HookProfile } from '../v4Hooks.js';
import { SelectedV4Pool } from '../v4ExecutionPlan.js';
import { zoraService } from '../../zoraService.js';
import {
    resolveHintedPoolFromSwapSupply as resolveHintedPoolFromSourceTx
} from './supplyParser.js';
import type { DexFamily, DexStrategy, HintedSourcePool, DirectSwapHint } from '../directSwapTypes.js';
import type {
    DirectSwapExecutionMode,
    DirectSwapResult,
    DirectSwapTraceState,
    LiquidityLayerStatus,
    ReferenceQuoteDiagnostics,
    TokenLiquidity
} from './types.js';
import { CHAIN_STRATEGIES } from './constants.js';
import { deriveHintStrategy, mergeStrategies } from './hint.js';
import { pickBestPoolByLiveSnapshot } from './onchainPoolSnapshot.js';
import { summarizePools } from './poolDiscovery.js';
import {
    computeTurboDeadline,
    isTurboBudgetExceeded,
    singlePoolTurboResolver,
    sourcePoolToResolvedHint,
    type ResolvedPoolHint
} from './turbo.js';
import {
    v4GasCacheKey,
} from './cache.js';
import {
    evaluateBuyLiquidityProtection,
    evaluateResolvedHintFastPathLiquidityGateFromPools,
    evaluateSourceAnchorQuote,
    poolPassesRequiredReserve,
    resolveSourceAnchorExpectation
} from './domain/guards.js';
import type { HintLiquidityGateResult } from './domain/guards.js';
import {
    buildTurboRescueOrder,
    capTurboRescueCandidatePools
} from './domain/candidatePlan.js';
import { parseAmountInWeiByToken } from './domain/amount.js';
import {
    isTransientRpcFailureForPreSim,
    shouldSkipResolvedHintRetry,
    summarizeRpcError
} from './pipeline/failureClassifier.js';
import { classifyFailure } from './domain/failure.js';
import { isSameHintPair, normalizePairTokenForHint } from './domain/hintPair.js';
import {
    createZoraQuoteWithRetry,
    executeV3VirtualBridgeSwap,
    executeZoraSdkSwap,
    get0xExpectedOutput,
    getZoraSdkExpectedOutput,
    isDirectSwapSupported
} from './application/extraExecutors.js';
import {
    callV4QuoterExactOut,
    getAerodromeExpectedOutput,
    getInfinityBestQuoteOut,
    getReferenceExpectedOutput,
    getV2ExpectedOutput,
    getV3BestQuoteOut,
    getV3BridgeQuoteOut,
    getV4BestPoolQuote,
    type InfinityBestQuote
} from './application/quoteEngines.js';
import {
    VIRTUAL_TOKEN_ADDRESSES,
    WETH_ADDRESSES,
    ZORA_TOKEN_ADDRESSES,
    createDirectSwapTraceId,
    getChainSlugForUsdLookup,
    getTxExecutionProfile,
    isBuySideStableOrNativeIn,
    isStableTokenAddress,
    pickDepthMultiplierByUsd,
    providerToStrategy,
    withAbortableTimeout,
    withTimeout
} from './pipeline/context.js';
import {
    executeInfinityRoute as executeInfinitySwapExecutor,
    executeV2Route as executeV2SwapExecutor,
    executeV3Route as executeV3SwapExecutor,
    executeV4Route as executeV4SwapExecutor
} from './pipeline/routeExecutor.js';
import { isHintFastPathEligible } from './pipeline/hintFastPath.js';
import { buildTimelineMs, withFailureCode } from './pipeline/trace.js';
import { capReferenceQuoteByMaxInput, computeMinReasonable } from './pipeline/referenceGate.js';
import {
    clearNoPoolCache as clearNoPoolCacheFromPipeline,
    getCachedSinglePoolWinnerHint as getCachedSinglePoolWinnerHintFromPipeline,
    getCachedV4GasLimit as getCachedV4GasLimitFromPipeline,
    getCachedWinningStrategy as getCachedWinningStrategyFromPipeline,
    isFreshNoPoolCache as isFreshNoPoolCacheFromPipeline,
    setCachedSinglePoolWinnerHint as setCachedSinglePoolWinnerHintFromPipeline,
    setCachedV4GasLimit as setCachedV4GasLimitFromPipeline,
    setCachedWinningStrategy as setCachedWinningStrategyFromPipeline,
    setNoPoolCache as setNoPoolCacheFromPipeline
} from './pipeline/cache.js';
import {
    evaluateAerodromeBuySideDepth as evaluateAerodromeBuySideDepthFromPoolLayer,
    evaluateResolvedHintFastPathLiquidityGate as evaluateResolvedHintFastPathLiquidityGateFromPoolLayer,
    getTokenLiquidity as getTokenLiquidityFromPoolLayer
} from './pipeline/poolLayer.js';
import {
    createOrderRuntimeContext,
    markOrderFailure,
    recordLifecycleOnOrder,
    recordOrderRoute,
    setOrderMetadata
} from '../../order-runtime/context.js';
import { logOrderRuntimeSnapshot } from '../../order-runtime/sinks/logger.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import {
    runResolvedHintFastPathFlow,
    tryResolvedPoolHintFastPath as tryResolvedPoolHintFastPathFromPipeline
} from './pipeline/resolvedHintFastPath.js';
import { runTurboRescueFlow } from './pipeline/turboFlow.js';
import { runTurboCorrectFlow } from './pipeline/turboCorrectFlow.js';
import { buildStrategyEvaluationContext } from './pipeline/strategyEngine.js';
import { prepareNormalQuotedStrategies } from './pipeline/normalQuoteFlow.js';
import { buildStrategyQuoteKey } from './quote/types.js';

// V3 QuoterV2 addresses (on-chain quote)
const V3_QUOTER_V2: Record<number, string> = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
};

const v3QuoterInterface = new ethers.Interface([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const v2RouterInterface = new ethers.Interface(V2_ROUTER_ABI);
const poolTokenInterface = new ethers.Interface([
    'function token0() view returns (address)',
    'function token1() view returns (address)'
]);
const infinityQuoterInterface = new ethers.Interface([
    'function quoteExactInputSingle((tuple(address currency0,address currency1,address hooks,address poolManager,uint24 fee,bytes32 parameters),bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)'
]);
const infinityRouterInterface = new ethers.Interface([
    'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
]);

const V2_ROUTERS: Record<number, string> = {
    1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',   // Uniswap V2
    8453: '0x4752ba5Dbc23f44D87826276BF6Fd6b1C372aD24', // Uniswap V2 on Base
    56: '0x10ED43C718714eb63d5aA57B78B54704E256024E'    // PancakeSwap V2
};

// PancakeSwap V3 (BSC)
const PANCAKE_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
const PANCAKE_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const PANCAKE_V3_FEE_TIERS = [100, 500, 2500, 10000] as const;

// Pancake Infinity (BSC)
const PANCAKE_INFINITY_ROUTER = '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB';
const PANCAKE_INFINITY_CL_POOL_MANAGER = '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b';
const PANCAKE_INFINITY_BIN_POOL_MANAGER = '0xC697d2898e0D09264376196696c51D7aBbbAA4a9';
const PANCAKE_INFINITY_CL_QUOTER = '0xd0737C9762912dD34c3271197E362Aa736Df0926';
const PANCAKE_INFINITY_BIN_QUOTER = '0xC631f4B0Fc2Dd68AD45f74B2942628db117dD359';

const INFINITY_CL_FEE_TIERS = [100, 500, 2500, 10000] as const;
const INFINITY_CL_TICK_SPACING_BY_FEE: Record<number, number> = {
    100: 1,
    500: 10,
    2500: 50,
    10000: 200
};
const INFINITY_BIN_STEPS = [1, 5, 10, 20, 25, 50, 100] as const;
const INFINITY_HOOKS_ZERO = '0x0000000000000000000000000000000000000000';

const REFERENCE_DEVIATION_BPS = Number(process.env.DIRECT_SWAP_REF_DEVIATION_BPS || '1500');
const ZORA_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_TIMEOUT_MS || '5000');
const DIRECT_SWAP_HINT_POOL_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_HINT_POOL_TIMEOUT_MS || '1400');
const DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS || '8000');
const DIRECT_SWAP_TURBO_POOL_DISCOVERY_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_TURBO_POOL_DISCOVERY_TIMEOUT_MS || '2200');
const DIRECT_SWAP_TURBO_RESCUE_POOL_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_TURBO_RESCUE_POOL_TIMEOUT_MS || '12000');
const DIRECT_SWAP_FASTPATH_BUDGET_MS = Number(process.env.DIRECT_SWAP_FASTPATH_BUDGET_MS || '3500');
const DIRECT_SWAP_TURBO_SINGLE_POOL_PHASE_MS = Number(process.env.DIRECT_SWAP_TURBO_SINGLE_POOL_PHASE_MS || '1200');
const DIRECT_SWAP_TURBO_SKIP_CANDIDATE_GATE_WITH_HINT = (process.env.DIRECT_SWAP_TURBO_SKIP_CANDIDATE_GATE_WITH_HINT || 'true') === 'true';
const DIRECT_SWAP_TURBO_V4_GAS_LIMIT = process.env.DIRECT_SWAP_TURBO_V4_GAS_LIMIT || '950000';
const DIRECT_SWAP_TURBO_V3_GAS_LIMIT = process.env.DIRECT_SWAP_TURBO_V3_GAS_LIMIT || '420000';
const V4_FAST_PATH = (process.env.DIRECT_SWAP_V4_FAST_PATH || 'true') === 'true';
const NO_POOL_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_NO_POOL_CACHE_TTL_MS || '15000');
const ZORA_RETRY_COUNT = Number(process.env.DIRECT_SWAP_ZORA_RETRY_COUNT || '1');
const WINNING_ROUTE_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_WINNING_ROUTE_CACHE_TTL_MS || '600');
const DIRECT_SWAP_TURBO_BUDGET_WARN_MS = Number(process.env.DIRECT_SWAP_TURBO_BUDGET_WARN_MS || '2000');
const DIRECT_SWAP_GAS_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_GAS_CACHE_TTL_MS || '600000');
const V4_DYNAMIC_FEE_FLAG = 0x800000;
const TURBO_RESCUE_MAX_CANDIDATES_PER_KIND = Number(process.env.DIRECT_SWAP_TURBO_RESCUE_MAX_PER_KIND || '2');
const TURBO_RESCUE_MAX_TOTAL_CANDIDATES = Number(process.env.DIRECT_SWAP_TURBO_RESCUE_MAX_TOTAL || '6');

type DirectSwapRpcOptions = {
    strategy?: 'fast' | 'cheap';
    importance?: 'normal' | 'critical';
    exhaustiveFailover?: boolean;
};

async function callRpc<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any = [],
    options: DirectSwapRpcOptions = {}
): Promise<T> {
    return callRpcBase<T>(chainIdOrName, method, params, {
        strategy: options.strategy || 'fast',
        importance: options.importance || 'critical',
        exhaustiveFailover: options.exhaustiveFailover ?? true
    });
}

const DIRECT_SWAP_BUY_LIQ_MULTIPLIER = Number(process.env.DIRECT_SWAP_BUY_LIQ_MULTIPLIER || '100');
const COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS = Math.max(1, Number(process.env.COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS || '7000'));
const COPYTRADE_SOURCE_ANCHOR_MAX_RATIO_BPS = Math.max(
    COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS,
    Number(process.env.COPYTRADE_SOURCE_ANCHOR_MAX_RATIO_BPS || '14000')
);

function getCachedV4GasLimit(key: string): string | null {
    return getCachedV4GasLimitFromPipeline(key, DIRECT_SWAP_GAS_CACHE_TTL_MS);
}

function setCachedV4GasLimit(key: string, gasLimit: string): void {
    setCachedV4GasLimitFromPipeline(key, gasLimit);
}

async function getCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string): Promise<DexStrategy | null> {
    return await getCachedWinningStrategyFromPipeline(
        chainId,
        tokenIn,
        tokenOut,
        WINNING_ROUTE_CACHE_TTL_MS * 1000
    );
}

async function setCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string, strategy: DexStrategy): Promise<void> {
    await setCachedWinningStrategyFromPipeline(
        chainId,
        tokenIn,
        tokenOut,
        strategy,
        WINNING_ROUTE_CACHE_TTL_MS
    );
}

async function getCachedSinglePoolWinnerHint(
    chainId: number,
    tokenIn: string,
    tokenOut: string
): Promise<ResolvedPoolHint | null> {
    return await getCachedSinglePoolWinnerHintFromPipeline(
        chainId,
        tokenIn,
        tokenOut,
        WINNING_ROUTE_CACHE_TTL_MS * 1000
    );
}

async function setCachedSinglePoolWinnerHint(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    hint: ResolvedPoolHint
): Promise<void> {
    await setCachedSinglePoolWinnerHintFromPipeline(
        chainId,
        tokenIn,
        tokenOut,
        hint,
        WINNING_ROUTE_CACHE_TTL_MS
    );
}

async function isFreshNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): Promise<boolean> {
    return await isFreshNoPoolCacheFromPipeline(chainId, tokenIn, tokenOut, NO_POOL_CACHE_TTL_MS);
}

function setNoPoolCache(chainId: number, tokenIn: string, tokenOut: string, reason: string): void {
    setNoPoolCacheFromPipeline(chainId, tokenIn, tokenOut, reason, NO_POOL_CACHE_TTL_MS);
}

function clearNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): void {
    clearNoPoolCacheFromPipeline(chainId, tokenIn, tokenOut);
}

async function pickBestPool(
    pools: PoolInfo[],
    version: PoolInfo['version'],
    chainId: number,
    dex?: DexFamily
): Promise<PoolInfo | null> {
    return await pickBestPoolByLiveSnapshot({ pools, version, chainId, dex });
}

export async function getTokenLiquidity(
    tokenAddress: string,
    chainId: number
): Promise<TokenLiquidity> {
    return await getTokenLiquidityFromPoolLayer(tokenAddress, chainId);
}

type DirectSwapExecutionParams = {
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountInWei: bigint;
    chainId: number;
    slippageBps: number;
};

async function executeV2Swap(
    params: DirectSwapExecutionParams,
    expectedOut: bigint
): Promise<DirectSwapResult> {
    return executeV2SwapExecutor(params, expectedOut, {
        v2Routers: V2_ROUTERS,
        wethAddresses: WETH_ADDRESSES,
        v2RouterInterface,
        callRpc,
        sendTransaction: sendTransactionLifecycle,
        getTxExecutionProfile
    });
}

async function executeV3Swap(
    params: DirectSwapExecutionParams,
    pool: PoolInfo,
    dex: 'uniswap' | 'pancake',
    options?: { fastMode?: boolean; executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
    return executeV3SwapExecutor(params, pool, dex, {
        wethAddresses: WETH_ADDRESSES,
        pancakeV3Router: PANCAKE_V3_ROUTER,
        pancakeV3Quoter: PANCAKE_V3_QUOTER,
        pancakeV3FeeTiers: PANCAKE_V3_FEE_TIERS,
        v3QuoterByChain: V3_QUOTER_V2,
        v3FeeTiers: V3_FEE_TIERS,
        v3QuoterInterface,
        turboV3GasLimit: DIRECT_SWAP_TURBO_V3_GAS_LIMIT,
        callRpc,
        sendTransaction: sendTransactionLifecycle,
        getTxExecutionProfile,
        get0xExpectedOutput
    }, options);
}

async function executeV4Swap(
    params: DirectSwapExecutionParams,
    pool: SelectedV4Pool,
    options?: {
        allowZeroQuoteMinOut?: boolean;
        fastMode?: boolean;
        executionMode?: DirectSwapExecutionMode;
        trustedHint?: boolean;
    }
): Promise<DirectSwapResult> {
    return executeV4SwapExecutor(params, pool, {
        callRpc,
        sendTransaction: sendTransactionLifecycle,
        callV4QuoterExactOut,
        getV4BestPoolQuote,
        summarizeRpcError,
        isTransientRpcFailureForPreSim,
        getTxExecutionProfile,
        v4GasCacheKey,
        getCachedV4GasLimit,
        setCachedV4GasLimit,
        turboV4GasLimit: DIRECT_SWAP_TURBO_V4_GAS_LIMIT
    }, options);
}

async function executeInfinitySwap(
    params: DirectSwapExecutionParams,
    quote: InfinityBestQuote,
    options?: { executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
    return executeInfinitySwapExecutor(params, quote, {
        wethAddresses: WETH_ADDRESSES,
        pancakeInfinityRouter: PANCAKE_INFINITY_ROUTER,
        infinityRouterInterface,
        callRpc,
        sendTransaction: sendTransactionLifecycle,
        getTxExecutionProfile
    }, options);
}

function shouldBypassTurboRescueForSinglePoolError(error?: string): {
    skip: boolean;
    reason: string;
    failureCode: string;
} {
    const raw = String(error || '');
    const lower = raw.toLowerCase();
    const failureCode = classifyFailure(raw);
    if (!lower) {
        return {
            skip: false,
            reason: 'empty_error',
            failureCode
        };
    }

    const nonRouteFailureCodes = new Set<string>([
        'failed_insufficient_funds',
        'failed_rpc_rate_limited',
        'failed_invalid_amount_in'
    ]);
    if (nonRouteFailureCodes.has(failureCode)) {
        return {
            skip: true,
            reason: `non_route_failure_code:${failureCode}`,
            failureCode
        };
    }

    const nonRouteFailureMarkers = [
        'failed_to_send_transaction',
        'failed_to_get_user_wallet',
        'no valid authorization signatures',
        'authorization signatures',
        'max fee per gas less than block base fee',
        'nonce too low',
        'already known',
        'replacement transaction underpriced',
        'v4_pre_sim_rpc_failed',
        'v3_pre_sim_rpc_failed',
        'all rpc endpoints failed',
        'capacity_limited',
        'circuit_open',
        'timeout_'
    ];
    if (nonRouteFailureMarkers.some((marker) => lower.includes(marker))) {
        return {
            skip: true,
            reason: 'non_route_failure_marker',
            failureCode
        };
    }

    return {
        skip: false,
        reason: 'route_related_or_unknown',
        failureCode
    };
}

/**
 * 执行直接交易
 * [Logic]: 根据池子版本选择 V3 或 V4 执行
 */
export async function executeDirectSwap(params: {
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
    mevProtection?: boolean;
    runtimeContext?: OrderRuntimeContext;
    _externalRetryAttempt?: number;
}): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps } = params;

    // [Logic]: 规范化 token 地址 - 处理 "ETH" / "WETH" 字符串
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    function normalizeToken(token: string, chainId: number): string {
        const upper = token.toUpperCase();
        if (upper === 'ETH') return ETH_ADDRESS;
        if (upper === 'WETH') return WETH_ADDRESSES[chainId] || token;
        return token;
    }
    const normalizedTokenIn = normalizeToken(tokenIn, chainId);
    const normalizedTokenOut = normalizeToken(tokenOut, chainId);
    const runtimeContext = params.runtimeContext || createOrderRuntimeContext({
        userId,
        chainId,
        walletAddress,
        mode: 'direct',
        side: isBuySideStableOrNativeIn(chainId, normalizedTokenIn)
            ? 'buy'
            : isBuySideStableOrNativeIn(chainId, normalizedTokenOut)
                ? 'sell'
                : 'unknown',
        sourceTxHash: params.hint?.sourceTxHash,
        tokenIn: normalizedTokenIn,
        tokenOut: normalizedTokenOut,
        metadata: {
            executionMode: params.executionMode || 'normal'
        }
    });
    params.runtimeContext = runtimeContext;
    const traceId = createDirectSwapTraceId(chainId, params.hint);
    const traceState: DirectSwapTraceState = {
        traceId,
        l1PoolStatus: 'unknown',
        l2RouteStatus: 'unknown',
        l3MarketStatus: 'unknown',
        poolCount: 0,
        poolKinds: { v2: 0, v3: 0, v4: 0 },
        referenceSource: 'none'
    };

    logger.info(LogCode.EXE_TX_BROADCAST, '[DirectSwap] Starting direct swap', {
        traceId,
        tokenIn: normalizedTokenIn,
        tokenOut: normalizedTokenOut,
        amount: amountIn,
        chainId,
        wallet: walletAddress
    });
    setOrderMetadata(runtimeContext, {
        traceId,
        hintedSourceTxHash: params.hint?.sourceTxHash || null
    });

    const swapStart = Date.now();
    let tPoolDiscoveryDone = 0;
    let tStrategyStart = 0;
    let tExecutionStart = 0;
    let poolCacheTokenIn = normalizedTokenIn;
    let poolCacheTokenOut = normalizedTokenOut;
    let selectedResolvedHintForCache: ResolvedPoolHint | null = null;
    const finish = async (result: DirectSwapResult): Promise<DirectSwapResult> => {
        const durationMs = Date.now() - swapStart;
        if (result.provider && result.provider !== 'failed') {
            const providerStrategy = providerToStrategy(result.provider, chainId);
            recordOrderRoute(runtimeContext, {
                provider: result.provider,
                poolKind: providerStrategy?.kind === 'zora-sdk' ? 'external' : (providerStrategy?.kind as any)
            });
        }
        if (result.txHash) {
            setOrderMetadata(runtimeContext, { directTxHash: result.txHash });
        }
        if (result.txLifecycle) {
            recordLifecycleOnOrder(runtimeContext, result.txLifecycle);
        } else if (result.error) {
            markOrderFailure(runtimeContext, result.error);
        }
        if (result.success) {
            clearNoPoolCache(chainId, poolCacheTokenIn, poolCacheTokenOut);
            const successfulStrategy = providerToStrategy(result.provider, chainId);
            if (successfulStrategy) {
                await setCachedWinningStrategy(chainId, poolCacheTokenIn, poolCacheTokenOut, successfulStrategy);
            }
            if (selectedResolvedHintForCache) {
                await setCachedSinglePoolWinnerHint(
                    chainId,
                    poolCacheTokenIn,
                    poolCacheTokenOut,
                    selectedResolvedHintForCache
                );
            }
        } else if (result.error) {
            const reasonCode = classifyFailure(result.error);
            result = withFailureCode(result, reasonCode);
            traceState.failureCode = reasonCode;
            if (reasonCode.includes('pool_unavailable_hard') && traceState.poolCount === 0) {
                setNoPoolCache(chainId, poolCacheTokenIn, poolCacheTokenOut, reasonCode);
            }
            const retryAttempt = Number(params._externalRetryAttempt || 0);
            const turboMode = params.executionMode === 'turbo';
            if (!turboMode && reasonCode === 'failed_external_quote_down' && retryAttempt < 1) {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Immediate retry for external quote failure', {
                    chainId,
                    retryAttempt: retryAttempt + 1,
                    reasonCode
                });
                const retried = await executeDirectSwap({
                    ...params,
                    _externalRetryAttempt: retryAttempt + 1
                });
                return retried;
            }
        }
        if (!result.success) {
            logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwapTrace] Attempt failed', {
                traceId,
                chainId,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
                executionMode: params.executionMode || 'normal',
                failureCode: traceState.failureCode || 'unknown',
                failureDetail: result.error || 'unknown',
                layers: {
                    l1_pool: traceState.l1PoolStatus,
                    l2_route: traceState.l2RouteStatus,
                    l3_market: traceState.l3MarketStatus
                },
                poolCount: traceState.poolCount,
                poolKinds: traceState.poolKinds,
                referenceSource: traceState.referenceSource,
                hintSourceTx: params.hint?.sourceTxHash || null,
                hintDex: params.hint?.sourceDexName || null
            });
        }
        logOrderRuntimeSnapshot(runtimeContext, '[OrderRuntime] direct-swap-finish');
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Finished', {
            traceId,
            provider: result.provider,
            success: result.success,
            durationMs,
            timelineMs: buildTimelineMs({
                startedAtMs: swapStart,
                poolDiscoveryDoneAtMs: tPoolDiscoveryDone,
                strategyStartAtMs: tStrategyStart,
                executionStartAtMs: tExecutionStart,
                finishedAtMs: Date.now()
            })
        });
        if (params.executionMode === 'turbo' && durationMs > DIRECT_SWAP_TURBO_BUDGET_WARN_MS) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo budget exceeded', {
                chainId,
                durationMs,
                budgetMs: DIRECT_SWAP_TURBO_BUDGET_WARN_MS,
                provider: result.provider,
                success: result.success
            });
        }
        return {
            ...result,
            runtimeContext
        };
    };

    try {
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        let cachedReferenceQuote: bigint | null = null;
        let fastPathReferenceCapped = false;

        // 1. 查找所有池子 (V2/V3/V4) - ETH 使用 WETH 地址匹配池子
        const weth = WETH_ADDRESSES[chainId];
        const poolTokenIn = normalizedTokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenIn;
        const poolTokenOut = normalizedTokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenOut;
        poolCacheTokenIn = poolTokenIn;
        poolCacheTokenOut = poolTokenOut;

        const preferredStrategy = deriveHintStrategy(chainId, params.hint);
        const turboOrHintStrategy = params.executionMode === 'turbo' || !!preferredStrategy?.kind;
        const allowNoPoolCache = !params.hint?.sourceTxHash && !turboOrHintStrategy;

        // ⚡ Parallel pre-pipeline: fire isFreshNoPoolCache, parseAmountInWeiByToken and
        //    getCachedWinningStrategy concurrently instead of sequentially (~100-200ms saved).
        const [noPoolCached, amountInWei, cachedWinningStrategy] = await Promise.all([
            allowNoPoolCache
                ? isFreshNoPoolCache(chainId, poolTokenIn, poolTokenOut)
                : Promise.resolve(false),
            parseAmountInWeiByToken({
                tokenIn: normalizedTokenIn,
                amountIn,
                chainId,
                getTokenMetadata,
                onRawWeiDetected: ({ decimals }) => {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] amountIn interpreted as raw wei amount', {
                        chainId,
                        tokenIn: normalizedTokenIn.slice(0, 12),
                        amountIn: String(amountIn).slice(0, 32),
                        decimals
                    });
                }
            }),
            preferredStrategy
                ? Promise.resolve(null)
                : getCachedWinningStrategy(chainId, poolTokenIn, poolTokenOut)
        ]);
        if (allowNoPoolCache && noPoolCached) {
            return finish({ success: false, error: 'No suitable pool found (cached)', provider: 'failed' });
        }
        if (amountInWei <= 0n) {
            return finish({ success: false, error: 'amountIn must be > 0', provider: 'failed' });
        }
        const defaultStrategies = CHAIN_STRATEGIES[chainId] || CHAIN_STRATEGIES[1];
        const requestedMode: DirectSwapExecutionMode = params.executionMode || 'normal';
        const fastHintMode = Boolean(params.hint?.sourceTxHash);
        const turboMode = requestedMode === 'turbo';
        const safeMode = requestedMode === 'safe';
        const autoBypassReferenceGate = fastHintMode && !!preferredStrategy && (
            preferredStrategy.kind === 'v4'
            || preferredStrategy.kind === 'infinity'
            || preferredStrategy.kind === 'aerodrome'
        );
        const bypassReferenceGate = safeMode
            ? false
            : ((params.hint?.bypassReferencePrice === true && !!preferredStrategy) || autoBypassReferenceGate);
        let skipReferenceQuote = safeMode ? false : (bypassReferenceGate || turboMode);
        let skipReferenceQuoteReason: 'bypass' | 'turbo' | 'buy_liquidity_100x' = bypassReferenceGate
            ? 'bypass'
            : turboMode
                ? 'turbo'
                : 'bypass';
        const zoraToken = ZORA_TOKEN_ADDRESSES[chainId]?.toLowerCase();
        const hintDexLower = String(params.hint?.sourceDexName || '').toLowerCase();
        const zoraLikely = chainId === 8453 && Boolean(
            (zoraToken && (normalizedTokenIn.toLowerCase() === zoraToken || normalizedTokenOut.toLowerCase() === zoraToken))
            || hintDexLower.includes('zora')
        );
        const virtualToken = VIRTUAL_TOKEN_ADDRESSES[chainId]?.toLowerCase();
        const virtualLikely = chainId === 8453 && Boolean(
            (virtualToken && (normalizedTokenIn.toLowerCase() === virtualToken || normalizedTokenOut.toLowerCase() === virtualToken))
            || hintDexLower.includes('virtual')
        );
        const zoraRoutesEnabled = chainId === 8453 && (!turboMode || zoraLikely);
        const normalizedParams = {
            ...params,
            tokenIn: normalizedTokenIn,
            tokenOut: normalizedTokenOut,
            amountInWei
        };
        const resolvedFastPathDeps = {
            logger,
            callRpc,
            executeV2Swap,
            executeV3Swap,
            executeV4Swap,
            executeAerodromeSwap,
            getV2ExpectedOutput,
            wrappedNativeByChain: WETH_ADDRESSES,
            sourceAnchorMinRatioBps: COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS,
            sourceAnchorMaxRatioBps: COPYTRADE_SOURCE_ANCHOR_MAX_RATIO_BPS
        };
        const turboFastDeadline = computeTurboDeadline(swapStart, DIRECT_SWAP_FASTPATH_BUDGET_MS);
        let earlyHintedPool: HintedSourcePool | null = null;
        let resolvedHintFastPathSkipped = false;
        let resolvedHintFastPathFailed = false;
        const resolvedHintOutcome = await runResolvedHintFastPathFlow({
            swapStart,
            chainId,
            traceId,
            requestedMode,
            turboMode,
            hint: params.hint,
            normalizedTokenIn,
            poolTokenIn,
            poolTokenOut,
            amountInWei,
            normalizedParams,
            turboFastDeadline,
            turboFastpathBudgetMs: DIRECT_SWAP_FASTPATH_BUDGET_MS,
            hintPoolTimeoutMs: DIRECT_SWAP_HINT_POOL_TIMEOUT_MS,
            liquidityMultiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
            fastPathDeps: resolvedFastPathDeps,
            deps: {
                logger,
                tryResolvedPoolHintFastPath: tryResolvedPoolHintFastPathFromPipeline,
                isHintFastPathEligible,
                evaluateResolvedHintFastPathLiquidityGate: evaluateResolvedHintFastPathLiquidityGateFromPoolLayer,
                isBuySideStableOrNativeIn,
                shouldSkipResolvedHintRetry,
                isTurboBudgetExceeded
            }
        });
        resolvedHintFastPathSkipped = resolvedHintOutcome.resolvedHintFastPathSkipped;
        resolvedHintFastPathFailed = resolvedHintOutcome.resolvedHintFastPathFailed;
        if (resolvedHintOutcome.selectedResolvedHintForCache) {
            selectedResolvedHintForCache = resolvedHintOutcome.selectedResolvedHintForCache as ResolvedPoolHint;
        }
        if (resolvedHintOutcome.result) {
            return finish(resolvedHintOutcome.result);
        }
        if (params.hint?.sourceTxHash && (!params.hint?.resolvedPoolHint || resolvedHintFastPathSkipped || resolvedHintFastPathFailed)) {
            const earlyHintBudgetMs = turboMode
                ? Math.max(200, Math.min(1200, turboFastDeadline - Date.now()))
                : 700;
            if (earlyHintBudgetMs > 0) {
                earlyHintedPool = await withTimeout(
                    resolveHintedPoolFromSourceTx({
                        tokenIn: poolTokenIn,
                        tokenOut: poolTokenOut,
                        chainId,
                        hint: params.hint
                    }),
                    earlyHintBudgetMs
                ).catch(() => null);
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Early hinted source pool probe', {
                    chainId,
                    mode: requestedMode,
                    budgetMs: earlyHintBudgetMs,
                    matched: Boolean(earlyHintedPool),
                    hintedKind: earlyHintedPool?.kind || null
                });
            }
        }

        if (turboMode) {
            const runTurboRescue = async (reason: string): Promise<DirectSwapResult> => {
                return await runTurboRescueFlow({
                    reason,
                    chainId,
                    traceId,
                    swapStart,
                    turboFastDeadline,
                    directSwapFastpathBudgetMs: DIRECT_SWAP_FASTPATH_BUDGET_MS,
                    directSwapHintPoolTimeoutMs: DIRECT_SWAP_HINT_POOL_TIMEOUT_MS,
                    directSwapTurboPoolDiscoveryTimeoutMs: Math.max(
                        DIRECT_SWAP_TURBO_POOL_DISCOVERY_TIMEOUT_MS,
                        DIRECT_SWAP_TURBO_RESCUE_POOL_TIMEOUT_MS
                    ),
                    directSwapBuyLiqMultiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                    turboRescueMaxCandidatesPerKind: TURBO_RESCUE_MAX_CANDIDATES_PER_KIND,
                    turboRescueMaxTotalCandidates: TURBO_RESCUE_MAX_TOTAL_CANDIDATES,
                    sourceAnchorMinRatioBps: COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS,
                    sourceAnchorMaxRatioBps: COPYTRADE_SOURCE_ANCHOR_MAX_RATIO_BPS,
                    normalizedTokenIn,
                    normalizedTokenOut,
                    poolTokenIn,
                    poolTokenOut,
                    amountInWei,
                    hint: params.hint,
                    walletAddress: params.walletAddress,
                    slippageBps: params.slippageBps,
                    normalizedParams,
                    wrappedNativeAddress: WETH_ADDRESSES[chainId] || '',
                    traceState,
                    deps: {
                        logger,
                        withTimeout,
                        findTokenPools: (tokenIn, tokenOut, targetChainId, options) =>
                            findTokenPools(tokenIn, tokenOut, targetChainId, options),
                        summarizePools,
                        buildTurboRescueOrder,
                        resolveSourceAnchorExpectation,
                        evaluateSourceAnchorQuote,
                        evaluateBuyLiquidityProtection,
                        poolPassesRequiredReserve,
                        capTurboRescueCandidatePools,
                        isBuySideStableOrNativeIn,
                        isV4SwapSupported,
                        getV4BestPoolQuote,
                        getV3BestQuoteOut,
                        getV2ExpectedOutput,
                        getAerodromeExpectedOutput,
                        pickBestPool,
                        executeV4Swap,
                        executeV3Swap,
                        executeV2Swap,
                        executeAerodromeSwap,
                        classifyFailure
                    }
                });
            };
            const turboCorrect = await runTurboCorrectFlow({
                chainId,
                traceId,
                swapStart,
                turboFastDeadline,
                turboSinglePoolPhaseMs: DIRECT_SWAP_TURBO_SINGLE_POOL_PHASE_MS,
                hintPoolTimeoutMs: DIRECT_SWAP_HINT_POOL_TIMEOUT_MS,
                skipCandidateGateWithHint: DIRECT_SWAP_TURBO_SKIP_CANDIDATE_GATE_WITH_HINT,
                buyLiqMultiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                normalizedTokenIn,
                poolTokenIn,
                poolTokenOut,
                amountInWei,
                hint: params.hint,
                earlyHintedPool,
                normalizedParams,
                logger,
                withTimeout,
                resolveHintedPoolFromSourceTx,
                getCachedSinglePoolWinnerHint,
                singlePoolResolver: singlePoolTurboResolver,
                isBuySideStableOrNativeIn,
                findTokenPools,
                evaluateResolvedHintFastPathLiquidityGateFromPools,
                tryResolvedPoolHintFastPath: (executeParams, hintParams, options) =>
                    tryResolvedPoolHintFastPathFromPipeline(
                        executeParams,
                        hintParams,
                        resolvedFastPathDeps,
                        options
                    ),
                shouldSkipResolvedHintRetry,
                shouldBypassTurboRescueForSinglePoolError,
                sourceAnchorMinRatioBps: COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS,
                sourceAnchorMaxRatioBps: COPYTRADE_SOURCE_ANCHOR_MAX_RATIO_BPS,
                wrappedNativeAddress: WETH_ADDRESSES[chainId] || '',
                getV4BestPoolQuote,
                getV3BestQuoteOut,
                getAerodromeExpectedOutput,
                getV2ExpectedOutput,
                runTurboRescue
            });
            if (turboCorrect.selectedResolvedHintForCache) {
                selectedResolvedHintForCache = turboCorrect.selectedResolvedHintForCache;
            }
            return finish(turboCorrect.result);
        }

        // Turbo now strictly executes single-pool hints only (resolved/source/cache).

        let infinityPrecheckFailed = false;

        let forceV4 = false;
        let preloadedV4Pools: V4PoolInfo[] | null = null;
        if (isV4SwapSupported(chainId)) {
            try {
                const v4BudgetMs = turboMode
                    ? Math.max(150, Math.min(800, turboFastDeadline - Date.now()))
                    : 5000;
                preloadedV4Pools = await withTimeout(
                    findV4Pools(poolTokenIn, poolTokenOut, chainId),
                    v4BudgetMs
                );
                forceV4 = preloadedV4Pools.some((p) => {
                    const family = resolveV4HookProfile(chainId, p.poolKey.hooks).family;
                    if (family === 'clanker') return true;
                    if (family === 'doppler') return true;
                    if (p.poolKey.fee === V4_DYNAMIC_FEE_FLAG && (family === 'custom' || family === 'unknown')) return true;
                    return false;
                });
            } catch {
                forceV4 = false;
            }
        }

        if (bypassReferenceGate && preferredStrategy?.kind === 'v4' && isV4SwapSupported(chainId)) {
            if ((preloadedV4Pools?.length || 0) === 0 && !params.hint?.resolvedPoolHint) {
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Skip early v4 bypass: no preloaded v4 pools and no resolved hint', {
                    chainId,
                    hintSourceTx: params.hint?.sourceTxHash
                });
            } else {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass reference gate by target hint (early v4)', {
                chainId,
                strategy: 'v4',
                hintSourceDex: params.hint?.sourceDexName,
                hintSourceRouter: params.hint?.sourceRouter,
                hintSourceTx: params.hint?.sourceTxHash
            });
            const v4Best = await getV4BestPoolQuote(
                poolTokenIn,
                poolTokenOut,
                amountInWei,
                chainId,
                params.walletAddress,
                params.hint,
                { preloadedPools: preloadedV4Pools || undefined }
            );
            if (v4Best.pool && (v4Best.amountOut > 0n || forceV4)) {
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                    strategy: 'v4',
                    amountOut: v4Best.amountOut.toString(),
                    poolId: v4Best.pool.poolAddress,
                    fee: v4Best.pool.fee,
                    reason: v4Best.amountOut > 0n ? 'quoted' : 'force_v4_clanker'
                });
                return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                    allowZeroQuoteMinOut: v4Best.amountOut <= 0n && forceV4,
                    fastMode: turboMode,
                    executionMode: requestedMode,
                    trustedHint: Boolean(params.hint?.sourceTxHash || params.hint?.resolvedPoolHint)
                }));
            }
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Early v4 bypass unavailable, continue fallback flow', {
                chainId
            });
            }
        }

        if (!bypassReferenceGate && !skipReferenceQuote && !turboMode && V4_FAST_PATH && isV4SwapSupported(chainId)) {
            const fastStart = Date.now();
            const [v4Best, referenceQuote] = await Promise.all([
                getV4BestPoolQuote(
                    poolTokenIn,
                    poolTokenOut,
                    amountInWei,
                    chainId,
                    params.walletAddress,
                    params.hint,
                    { preloadedPools: preloadedV4Pools || undefined }
                ),
                getReferenceExpectedOutput(
                    normalizedTokenIn,
                    normalizedTokenOut,
                    amountInWei,
                    chainId,
                    params.slippageBps,
                    params.walletAddress,
                    { enableZoraRoutes: zoraRoutesEnabled }
                )
            ]);
            const cappedFastPath = capReferenceQuoteByMaxInput({
                referenceQuote,
                amountInWei
            });
            const fastPathCap = amountInWei * 1_000_000n;
            const cappedRef = cappedFastPath.quote;
            cachedReferenceQuote = cappedRef;
            if (cappedFastPath.capped) {
                fastPathReferenceCapped = true;
                logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Reference quote sanity cap (fast path): exceeds max reasonable', {
                    traceId,
                    referenceQuote: referenceQuote.toString().slice(0, 20),
                    maxReasonable: fastPathCap.toString().slice(0, 20)
                });
            }

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 fast path quote check', {
                v4Quote: v4Best.amountOut.toString().slice(0, 15),
                referenceQuote: cappedRef.toString().slice(0, 15),
                durationMs: Date.now() - fastStart
            });

            if (forceV4 && v4Best.pool) {
                logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 fast path forced (clanker)', {
                    amountOut: v4Best.amountOut.toString(),
                    poolId: v4Best.pool.poolAddress,
                    fee: v4Best.pool.fee
                });
                return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                    allowZeroQuoteMinOut: true,
                    fastMode: turboMode,
                    executionMode: requestedMode
                }));
            }

            if (v4Best.pool && v4Best.amountOut > 0n && cappedRef > 0n) {
                const minReasonable = computeMinReasonable(cappedRef, REFERENCE_DEVIATION_BPS);
                if (v4Best.amountOut >= minReasonable) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 fast path accepted', {
                        minReasonable: minReasonable.toString(),
                        amountOut: v4Best.amountOut.toString(),
                        poolId: v4Best.pool.poolAddress,
                        fee: v4Best.pool.fee
                    });
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                        fastMode: turboMode,
                        executionMode: requestedMode,
                        trustedHint: Boolean(params.hint?.sourceTxHash || params.hint?.resolvedPoolHint)
                    }));
                }
            }

            logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 fast path fallback', {
                reason: v4Best.amountOut <= 0n ? 'v4_quote_unavailable'
                    : cappedRef <= 0n ? 'reference_quote_unavailable'
                        : 'v4_quote_not_reasonable'
            });
            if (forceV4) {
                return finish({ success: false, error: 'clanker_force_v4_failed', provider: 'uniswap-v4' });
            }
        }

        // Fast-hint for BSC: try Infinity first to avoid expensive pool scans on hot path.
        if (turboMode && chainId === 56 && preferredStrategy?.kind === 'infinity') {
            const infStart = Date.now();
            const infinityQuote = await getInfinityBestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId);
            if (infinityQuote && infinityQuote.amountOut > 0n) {
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Fast-hint Infinity precheck selected', {
                    amountOut: infinityQuote.amountOut.toString(),
                    fee: infinityQuote.fee,
                    kind: infinityQuote.kind,
                    durationMs: Date.now() - infStart
                });
                return finish(await executeInfinitySwap(normalizedParams, infinityQuote, { executionMode: requestedMode }));
            }
            infinityPrecheckFailed = true;
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Fast-hint Infinity precheck failed, fallback to pool discovery', {
                durationMs: Date.now() - infStart
            });
        }

        const poolStart = Date.now();
        let pools: PoolInfo[] = [];
        const skipPoolDiscovery = Boolean(earlyHintedPool);
        if (turboMode && isTurboBudgetExceeded(swapStart, DIRECT_SWAP_FASTPATH_BUDGET_MS)) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast-path budget exceeded before pool discovery, continue with fallback discovery', {
                chainId,
                elapsedMs: Date.now() - swapStart,
                budgetMs: DIRECT_SWAP_FASTPATH_BUDGET_MS
            });
        }
        if (skipPoolDiscovery) {
            pools = [];
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery skipped in fast-hint mode', {
                chainId,
                preferredStrategy: preferredStrategy?.kind,
                reason: 'hinted_pool_ready'
            });
        } else {
            try {
                const basePoolBudgetMs = turboMode
                    ? (infinityPrecheckFailed
                        ? DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS
                        : (params.hint?.sourceTxHash || params.hint?.resolvedPoolHint
                            ? DIRECT_SWAP_HINT_POOL_TIMEOUT_MS
                            : DIRECT_SWAP_TURBO_POOL_DISCOVERY_TIMEOUT_MS))
                    : DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS;
                const poolBudgetMs = turboMode
                    ? Math.max(120, Math.min(basePoolBudgetMs, turboFastDeadline - Date.now()))
                    : basePoolBudgetMs;
                pools = await withTimeout(
                    findTokenPools(poolTokenIn, poolTokenOut, chainId, { fastScan: true }),
                    poolBudgetMs
                );
            } catch {
                pools = [];
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Pool discovery timeout, continuing with fallback strategies', {
                    chainId,
                    mode: requestedMode,
                    hintSourceTx: params.hint?.sourceTxHash || null,
                    hadEarlyHintPool: Boolean(earlyHintedPool),
                    timeoutMs: turboMode
                        ? (infinityPrecheckFailed
                            ? DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS
                            : (params.hint?.sourceTxHash || params.hint?.resolvedPoolHint
                                ? DIRECT_SWAP_HINT_POOL_TIMEOUT_MS
                                : DIRECT_SWAP_TURBO_POOL_DISCOVERY_TIMEOUT_MS))
                        : DIRECT_SWAP_POOL_DISCOVERY_TIMEOUT_MS
                });
            }
        }
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery complete', {
            traceId,
            poolCount: pools.length,
            durationMs: Date.now() - poolStart
        });
        // Backfill preloadedV4Pools from pool discovery results when the dedicated v4 lookup missed/timed out
        if (!preloadedV4Pools?.length && pools.some((p) => p.version === 'v4')) {
            const v4FromDiscovery = pools.filter((p) => p.version === 'v4');
            preloadedV4Pools = v4FromDiscovery.map((p) => ({
                poolId: p.poolAddress,
                poolKey: {
                    currency0: p.token0,
                    currency1: p.token1,
                    hooks: '0x0000000000000000000000000000000000000000',
                    fee: p.fee ?? 3000,
                    tickSpacing: 60
                },
                sqrtPriceX96: p.sqrtPriceX96 || '0',
                tick: 0,
                liquidity: p.liquidity || '0',
                protocolFee: 0,
                lpFee: p.fee ?? 3000
            })) satisfies V4PoolInfo[];
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Backfilled preloadedV4Pools from pool discovery', {
                traceId,
                count: preloadedV4Pools.length,
                poolIds: preloadedV4Pools.map((p) => p.poolId.slice(0, 12))
            });
        }
        const poolSummary = summarizePools(pools);
        traceState.poolCount = poolSummary.poolsFound;
        traceState.poolKinds = poolSummary.poolKinds;
        traceState.l1PoolStatus = skipPoolDiscovery ? 'skipped' : (pools.length > 0 ? 'ok' : 'missing');
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery details', {
            traceId,
            chainId,
            poolKinds: poolSummary.poolKinds,
            pools: pools.slice(0, 8).map((p) => ({
                version: p.version,
                dex: p.dex,
                pool: String(p.poolAddress || '').slice(0, 14),
                fee: p.fee || 0,
                reserve0: String(p.reserve0 || '0').slice(0, 18),
                reserve1: String(p.reserve1 || '0').slice(0, 18),
                liquidity: String(p.liquidity || '0').slice(0, 18)
            }))
        });
        tPoolDiscoveryDone = Date.now();

        if (!safeMode && !skipReferenceQuote && isBuySideStableOrNativeIn(chainId, normalizedTokenIn) && pools.length > 0) {
            const buyLiqGuard = evaluateBuyLiquidityProtection(
                pools,
                poolTokenIn,
                amountInWei,
                Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
            );
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Buy liquidity guard evaluation', {
                traceId,
                chainId,
                algorithm: 'buy_liquidity_multiplier',
                multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                amountInWei: amountInWei.toString().slice(0, 20),
                requiredReserveInWei: buyLiqGuard.requiredReserveInWei.toString().slice(0, 20),
                checkedPools: buyLiqGuard.checkedPools,
                matchedPools: buyLiqGuard.matchedPools,
                byVersion: buyLiqGuard.byVersion,
                sample: buyLiqGuard.sample
            });
            if (buyLiqGuard.eligible) {
                skipReferenceQuote = true;
                skipReferenceQuoteReason = 'buy_liquidity_100x';
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Reference gate bypassed by buy liquidity guard', {
                    traceId,
                    chainId,
                    multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                    matchedPools: buyLiqGuard.matchedPools,
                    requiredReserveInWei: buyLiqGuard.requiredReserveInWei.toString().slice(0, 20)
                });
            }
        }

        if (pools.length === 0) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] No pool found for token pair', {
                traceId,
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                chainId
            });

            // Sniper safeguard: source tx may carry a resolvable pool even when static discovery misses it.
            if (params.hint?.sourceTxHash) {
                const hintedPool = earlyHintedPool || await withTimeout(
                    resolveHintedPoolFromSourceTx({
                        tokenIn: poolTokenIn,
                        tokenOut: poolTokenOut,
                        chainId,
                        hint: params.hint
                    }),
                    turboMode ? Math.max(220, Math.min(1200, turboFastDeadline - Date.now())) : 1200
                ).catch(() => null);
                logger.info(LogCode.SYS_INFO, '[DirectSwap] No-pool hinted fallback probe', {
                    chainId,
                    mode: requestedMode,
                    hintSourceTx: params.hint.sourceTxHash,
                    earlyHinted: Boolean(earlyHintedPool),
                    matched: Boolean(hintedPool),
                    hintedKind: hintedPool?.kind || null
                });
                if (hintedPool?.kind === 'v4') {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Sniper fallback selected (hinted v4 source tx)', {
                        strategy: 'v4-hinted-source',
                        poolId: hintedPool.pool.poolAddress,
                        hook: hintedPool.pool.poolKey.hooks,
                        fee: hintedPool.pool.poolKey.fee
                    });
                    return finish(await executeV4Swap(normalizedParams, hintedPool.pool, {
                        allowZeroQuoteMinOut: true,
                        fastMode: turboMode,
                        executionMode: requestedMode,
                        trustedHint: true
                    }));
                }
                if (hintedPool?.kind === 'v3') {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Sniper fallback selected (hinted v3 source tx)', {
                        strategy: `v3-hinted-source:${hintedPool.dex}`,
                        pool: hintedPool.pool.poolAddress,
                        fee: hintedPool.pool.fee
                    });
                    return finish(await executeV3Swap(normalizedParams, hintedPool.pool, hintedPool.dex, {
                        fastMode: turboMode,
                        executionMode: requestedMode
                    }));
                }
                if (hintedPool?.kind === 'v2') {
                    const v2Quote = await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
                    if (v2Quote > 0n) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Sniper fallback selected (hinted v2 source tx)', {
                            strategy: `v2-hinted-source:${hintedPool.dex || 'uniswap'}`,
                            pool: hintedPool.pool.poolAddress,
                            amountOut: v2Quote.toString()
                        });
                        return finish(await executeV2Swap(normalizedParams, v2Quote));
                    }
                }
            }

            // Hard fail fast: if source hints v4 but we still have no resolved source-tx pool, stop early.
            if (
                fastHintMode
                && preferredStrategy?.kind === 'v4'
                && !params.hint?.resolvedPoolHint
                && !earlyHintedPool
            ) {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast fail: no pool from hint/discovery/source-tx', {
                    chainId,
                    hintSourceTx: params.hint?.sourceTxHash
                });
                return finish({ success: false, error: 'No suitable pool found', provider: 'failed' });
            }
        }

        if (bypassReferenceGate && preferredStrategy) {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass reference gate by target hint', {
                chainId,
                strategy: `${preferredStrategy.kind}${preferredStrategy.dex ? `:${preferredStrategy.dex}` : ''}`,
                hintSourceDex: params.hint?.sourceDexName,
                hintSourceRouter: params.hint?.sourceRouter,
                hintSourceTx: params.hint?.sourceTxHash
            });

            if (preferredStrategy.kind === 'v4' && isV4SwapSupported(chainId)) {
                const v4Best = await withTimeout(
                    getV4BestPoolQuote(
                        poolTokenIn,
                        poolTokenOut,
                        amountInWei,
                        chainId,
                        params.walletAddress,
                        params.hint,
                        { preloadedPools: preloadedV4Pools || undefined }
                    ),
                    turboMode ? Math.max(150, Math.min(900, turboFastDeadline - Date.now())) : 1200
                ).catch(() => ({ pool: null, amountOut: 0n } as { pool: SelectedV4Pool | null; amountOut: bigint }));
                if (v4Best.pool && (v4Best.amountOut > 0n || forceV4)) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                        strategy: 'v4',
                        amountOut: v4Best.amountOut.toString(),
                        poolId: v4Best.pool.poolAddress,
                        fee: v4Best.pool.fee,
                        reason: v4Best.amountOut > 0n ? 'quoted' : 'force_v4_clanker'
                    });
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                        allowZeroQuoteMinOut: v4Best.amountOut <= 0n && forceV4,
                        fastMode: turboMode,
                        executionMode: requestedMode
                    }));
                }
            } else if (preferredStrategy.kind === 'v3') {
                const v3Dex = preferredStrategy.dex === 'pancake' ? 'pancake' : 'uniswap';
                const v3Pool = await pickBestPool(pools, 'v3', chainId, v3Dex);
                if (v3Pool) {
                    const v3Quote = await getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, v3Dex);
                    if (v3Quote > 0n) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                            strategy: `v3:${v3Dex}`,
                            amountOut: v3Quote.toString(),
                            pool: v3Pool.poolAddress,
                            fee: v3Pool.fee
                        });
                    return finish(await executeV3Swap(normalizedParams, v3Pool, v3Dex, { fastMode: turboMode, executionMode: requestedMode }));
                }
                }
            } else if (preferredStrategy.kind === 'aerodrome' && chainId === 8453) {
                if (isBuySideStableOrNativeIn(chainId, normalizedTokenIn)) {
                    const aeroDepth = evaluateAerodromeBuySideDepthFromPoolLayer(pools, poolTokenIn, amountInWei);
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Aerodrome depth gate (bypass)', {
                        chainId,
                        strategy: 'aerodrome',
                        checkedPools: aeroDepth.checkedPools,
                        matchedPools: aeroDepth.matchedPools,
                        requiredReserveInWei: aeroDepth.requiredReserveInWei.toString().slice(0, 20),
                        multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                        allowed: aeroDepth.eligible
                    });
                    if (!aeroDepth.eligible) {
                        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Bypass Aerodrome skipped: insufficient liquidity depth', {
                            chainId,
                            checkedPools: aeroDepth.checkedPools,
                            matchedPools: aeroDepth.matchedPools
                        });
                        // continue other strategies below
                    } else {
                        const aeroQuote = await getAerodromeExpectedOutput(
                            normalizedTokenIn,
                            normalizedTokenOut,
                            amountInWei,
                            chainId,
                            params.slippageBps,
                            params.walletAddress
                        );
                        if (aeroQuote > 0n) {
                            logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                                strategy: 'aerodrome',
                                amountOut: aeroQuote.toString()
                            });
                            return finish(await executeAerodromeSwap(normalizedParams));
                        }
                    }
                } else {
                const aeroQuote = await getAerodromeExpectedOutput(
                    normalizedTokenIn,
                    normalizedTokenOut,
                    amountInWei,
                    chainId,
                    params.slippageBps,
                    params.walletAddress
                );
                if (aeroQuote > 0n) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                        strategy: 'aerodrome',
                        amountOut: aeroQuote.toString()
                    });
                    return finish(await executeAerodromeSwap(normalizedParams));
                }
                }
            } else if (preferredStrategy.kind === 'v2') {
                const v2Pool = await pickBestPool(pools, 'v2', chainId, preferredStrategy.dex);
                if (v2Pool) {
                    const v2Quote = await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
                    if (v2Quote > 0n) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                            strategy: `v2:${preferredStrategy.dex || 'uniswap'}`,
                            amountOut: v2Quote.toString(),
                            pool: v2Pool.poolAddress
                        });
                        return finish(await executeV2Swap(normalizedParams, v2Quote));
                    }
                }
            } else if (preferredStrategy.kind === 'infinity' && chainId === 56) {
                const infinityQuote = await getInfinityBestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (infinityQuote && infinityQuote.amountOut > 0n) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                        strategy: 'infinity',
                        amountOut: infinityQuote.amountOut.toString(),
                        fee: infinityQuote.fee,
                        kind: infinityQuote.kind
                    });
                    return finish(await executeInfinitySwap(normalizedParams, infinityQuote, { executionMode: requestedMode }));
                }
            } else if (preferredStrategy.kind === 'virtual-bridge' && chainId === 8453) {
                const virtualToken = VIRTUAL_TOKEN_ADDRESSES[chainId];
                if (virtualToken) {
                    const bridgeQuote = await getV3BridgeQuoteOut(
                        poolTokenIn,
                        virtualToken,
                        poolTokenOut,
                        amountInWei,
                        chainId,
                        'uniswap'
                    );
                    if (bridgeQuote && bridgeQuote.amountOut > 0n) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                            strategy: 'virtual-bridge',
                            amountOut: bridgeQuote.amountOut.toString(),
                            feeInToVirtual: bridgeQuote.feeInToBridge,
                            feeVirtualToOut: bridgeQuote.feeBridgeToOut
                        });
                        return finish(await executeV3VirtualBridgeSwap(
                            normalizedParams,
                            virtualToken,
                            bridgeQuote,
                            {
                                callRpc,
                                sendTransaction,
                                getTxExecutionProfile,
                                wethAddresses: WETH_ADDRESSES
                            }
                        ));
                    }
                }
            } else if (preferredStrategy.kind === 'zora-sdk' && chainId === 8453) {
                const zoraQuote = await getZoraSdkExpectedOutput({
                    tokenIn: normalizedTokenIn,
                    tokenOut: normalizedTokenOut,
                    amountInWei,
                    chainId,
                    recipient: params.walletAddress
                }, {
                    zoraQuoteTimeoutMs: ZORA_QUOTE_TIMEOUT_MS,
                    createZoraQuoteWithRetry: (payload: any) => createZoraQuoteWithRetry(payload, {
                        zoraService,
                        retryCount: ZORA_RETRY_COUNT
                    }),
                    withTimeout
                });
                if (zoraQuote > 0n) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                        strategy: 'zora-sdk',
                        amountOut: zoraQuote.toString()
                    });
                    const zoraResult = await executeZoraSdkSwap(normalizedParams, {
                        createZoraQuoteWithRetry: (payload: any) => createZoraQuoteWithRetry(payload, {
                            zoraService,
                            retryCount: ZORA_RETRY_COUNT
                        }),
                        sendTransaction,
                        getTxExecutionProfile
                    });
                    if (zoraResult.success) {
                        return finish(zoraResult);
                    }
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Zora bypass execution failed, fallback to standard strategies', {
                        chainId,
                        error: zoraResult.error
                    });
                }
            }

            logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy unavailable, fallback to reference gate', {
                chainId,
                strategy: `${preferredStrategy.kind}${preferredStrategy.dex ? `:${preferredStrategy.dex}` : ''}`
            });
        }

        const refDiagnostics: ReferenceQuoteDiagnostics = {
            source: 'none',
            l2Status: 'unknown',
            l3Status: 'unknown'
        };
        let referenceQuote = skipReferenceQuote
            ? 0n
            : (cachedReferenceQuote ?? await getReferenceExpectedOutput(
                normalizedTokenIn,
                normalizedTokenOut,
                amountInWei,
                chainId,
                params.slippageBps,
                params.walletAddress,
                {
                    enableZoraRoutes: zoraRoutesEnabled,
                    diagnostics: refDiagnostics,
                    traceId
                }
            ));
        let referenceCappedToZero = false;
        if (referenceQuote <= 0n && fastPathReferenceCapped) {
            referenceCappedToZero = true;
        }
        if (referenceQuote > 0n) {
            const cappedFallback = capReferenceQuoteByMaxInput({
                referenceQuote,
                amountInWei
            });
            const fallbackMax = amountInWei * 1_000_000n;
            if (cappedFallback.capped) {
                logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Reference quote sanity cap (use-site): exceeds max reasonable', {
                    traceId,
                    referenceQuote: referenceQuote.toString().slice(0, 20),
                    maxReasonable: fallbackMax.toString().slice(0, 20)
                });
                referenceQuote = cappedFallback.quote;
                referenceCappedToZero = true;
            } else {
                try {
                    const [inDec, outDec] = await Promise.all([
                        getTokenDecimals(chainId, normalizedTokenIn, { defaultDecimals: 18 }),
                        getTokenDecimals(chainId, normalizedTokenOut, { defaultDecimals: 18 })
                    ]);
                    const maxReasonableOut = (amountInWei * BigInt(10 ** outDec) * 1_000_000n) / BigInt(10 ** inDec);
                    if (referenceQuote > maxReasonableOut) {
                        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Reference quote sanity cap (use-site): exceeds max reasonable', {
                            traceId,
                            referenceQuote: referenceQuote.toString().slice(0, 20),
                            maxReasonable: maxReasonableOut.toString().slice(0, 20)
                        });
                        referenceQuote = 0n;
                        referenceCappedToZero = true;
                    }
                } catch {
                    // keep referenceQuote as-is when metadata fails and we didn't already cap via fallbackMax
                }
            }
        }
        if (skipReferenceQuote) {
            traceState.referenceSource = `skipped:${skipReferenceQuoteReason}`;
            traceState.l2RouteStatus = 'skipped';
            traceState.l3MarketStatus = 'skipped';
        } else if (cachedReferenceQuote && cachedReferenceQuote > 0n && referenceQuote > 0n) {
            traceState.referenceSource = 'cache';
            traceState.l2RouteStatus = 'ok';
        } else {
            traceState.referenceSource = refDiagnostics.source;
            traceState.l2RouteStatus = refDiagnostics.l2Status;
            traceState.l3MarketStatus = refDiagnostics.l3Status;
        }

        const canUseSourceHintFallback = !!params.hint?.sourceTxHash;
        if (safeMode && referenceQuote <= 0n) {
            return finish({
                success: false,
                error: 'Safe mode requires valid reference price',
                provider: 'failed'
            });
        }
        if (referenceQuote <= 0n && pools.length === 0 && !canUseSourceHintFallback && !turboMode && !referenceCappedToZero && !skipReferenceQuote) {
            return finish({ success: false, error: 'No valid reference price (0x/Kyber/Gecko)', provider: 'failed' });
        }
        if (referenceQuote <= 0n && canUseSourceHintFallback) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Reference quote unavailable, continuing with source hint fallback', {
                chainId,
                txHash: params.hint?.sourceTxHash
            });
        }
        if (referenceQuote <= 0n && pools.length === 0 && !preferredStrategy && !turboMode && !referenceCappedToZero && !skipReferenceQuote) {
            return finish({ success: false, error: 'No valid reference price and no trusted hint strategy', provider: 'failed' });
        }
        if (referenceQuote <= 0n && (turboMode || referenceCappedToZero)) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Continuing without reference quote', {
                chainId,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
                reason: turboMode ? 'turbo' : 'reference_capped'
            });
        }
        if (referenceQuote <= 0n && skipReferenceQuoteReason === 'buy_liquidity_100x') {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Continuing without reference quote', {
                chainId,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut,
                reason: 'buy_liquidity_100x'
            });
        }

        const mergedStrategies = mergeStrategies(defaultStrategies, preferredStrategy || cachedWinningStrategy);
        const strategyContext = buildStrategyEvaluationContext({
            referenceQuote,
            deviationBps: REFERENCE_DEVIATION_BPS,
            mergedStrategies,
            preferredStrategy: preferredStrategy || null,
            forceV4,
            chainId,
            poolsCount: pools.length,
            zoraRoutesEnabled,
            virtualLikely
        });
        const noReferenceMode = strategyContext.noReferenceMode;
        const minReasonable = strategyContext.minReasonable;
        let strategies = strategyContext.strategies;
        let quoteByStrategyKey = new Map<string, bigint>();
        if (!turboMode) {
            const normalQuotedStrategies = await prepareNormalQuotedStrategies({
                strategies,
                chainId,
                tokenIn: poolTokenIn,
                tokenOut: poolTokenOut,
                amountInWei,
                slippageBps: params.slippageBps,
                walletAddress: params.walletAddress,
                hint: params.hint,
                pools,
                preloadedV4Pools,
                deps: {
                    pickBestPool,
                    getV4BestPoolQuote,
                    getV3BestQuoteOut,
                    getAerodromeExpectedOutput,
                    getV2ExpectedOutput
                }
            });
            strategies = normalQuotedStrategies.strategies;
            quoteByStrategyKey = normalQuotedStrategies.quoteByStrategyKey;
        }

        logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy evaluation start', {
            chainId,
            strategyOrder: strategies.map(s => `${s.kind}${s.dex ? `:${s.dex}` : ''}`).join(' > '),
            referenceQuote: referenceQuote.toString(),
            minReasonable: minReasonable.toString(),
            noReferenceMode,
            forceV4,
            hintSourceDex: params.hint?.sourceDexName,
            hintSourceRouter: params.hint?.sourceRouter,
            hintSourceTx: params.hint?.sourceTxHash,
            preferredStrategy: preferredStrategy ? `${preferredStrategy.kind}${preferredStrategy.dex ? `:${preferredStrategy.dex}` : ''}` : 'none',
            cachedWinningStrategy: cachedWinningStrategy ? `${cachedWinningStrategy.kind}${cachedWinningStrategy.dex ? `:${cachedWinningStrategy.dex}` : ''}` : 'none',
            fastHintMode,
            turboMode,
            requestedMode,
            zoraRoutesEnabled,
            quotedStrategyOrder: !turboMode
                ? strategies
                    .map((strategy) => ({
                        strategy: `${strategy.kind}${strategy.dex ? `:${strategy.dex}` : ''}`,
                        quotedOut: quoteByStrategyKey.get(buildStrategyQuoteKey(strategy))?.toString() || null
                    }))
                    .filter((entry) => entry.quotedOut !== null)
                : []
        });
        tStrategyStart = Date.now();

        for (const strategy of strategies) {
            if (forceV4 && strategy.kind !== 'v4') continue;
            if (strategy.kind === 'infinity') {
                if (chainId !== 56) continue;
                const infinityQuote = await getInfinityBestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (infinityQuote && infinityQuote.amountOut >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'infinity',
                        amountOut: infinityQuote.amountOut.toString(),
                        minReasonable: minReasonable.toString(),
                        fee: infinityQuote.fee,
                        kind: infinityQuote.kind
                    });
                    return finish(await executeInfinitySwap(normalizedParams, infinityQuote, { executionMode: requestedMode }));
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'infinity',
                    reason: !infinityQuote ? 'quote_unavailable' : 'quote_below_threshold',
                    amountOut: infinityQuote?.amountOut?.toString() || '0',
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v4') {
                if (!isV4SwapSupported(chainId)) continue;
                const hasV4Sources = (preloadedV4Pools?.length || 0) > 0
                    || !!params.hint?.resolvedPoolHint
                    || !!earlyHintedPool
                    || (turboMode && !!params.hint?.sourceTxHash);
                if (!hasV4Sources) {
                    logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                        strategy: 'v4',
                        reason: 'pool_unavailable_no_v4_sources',
                        amountOut: '0',
                        minReasonable: minReasonable.toString()
                    });
                    continue;
                }
                if (turboMode && params.hint?.sourceTxHash) {
                    const turboHintedPool: HintedSourcePool | null = earlyHintedPool
                        || await withTimeout(
                            resolveHintedPoolFromSourceTx({
                                tokenIn: poolTokenIn,
                                tokenOut: poolTokenOut,
                                chainId,
                                hint: params.hint
                            }),
                            Math.max(200, Math.min(900, turboFastDeadline - Date.now()))
                        ).catch(() => null);
                    if (turboHintedPool?.kind === 'v4') {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo strategy selected (hinted v4)', {
                            strategy: 'v4-hinted-turbo',
                            poolId: turboHintedPool.pool.poolAddress,
                            fee: turboHintedPool.pool.poolKey.fee
                        });
                        return finish(await executeV4Swap(normalizedParams, turboHintedPool.pool, {
                            allowZeroQuoteMinOut: true,
                            fastMode: turboMode,
                            executionMode: requestedMode,
                            trustedHint: true
                        }));
                    }
                }
                const v4Best = await withTimeout(
                    getV4BestPoolQuote(
                        poolTokenIn,
                        poolTokenOut,
                        amountInWei,
                        chainId,
                        params.walletAddress,
                        params.hint,
                        { preloadedPools: preloadedV4Pools || undefined }
                    ),
                    turboMode ? Math.max(180, Math.min(1000, turboFastDeadline - Date.now())) : 1300
                ).catch(() => ({ pool: null, amountOut: 0n } as { pool: SelectedV4Pool | null; amountOut: bigint }));
                if (forceV4 && v4Best.pool) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'v4',
                        reason: 'force_v4_clanker',
                        amountOut: v4Best.amountOut.toString(),
                        poolId: v4Best.pool.poolAddress,
                        fee: v4Best.pool.fee
                    });
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                        allowZeroQuoteMinOut: true,
                        fastMode: turboMode,
                        executionMode: requestedMode
                    }));
                }
                if (v4Best.pool && v4Best.amountOut > 0n && v4Best.amountOut >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'v4',
                        amountOut: v4Best.amountOut.toString(),
                        minReasonable: minReasonable.toString(),
                        poolId: v4Best.pool.poolAddress,
                        fee: v4Best.pool.fee
                    });
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool, {
                        fastMode: turboMode,
                        executionMode: requestedMode,
                        trustedHint: Boolean(params.hint?.sourceTxHash || params.hint?.resolvedPoolHint)
                    }));
                }
                if (forceV4) {
                    return finish({ success: false, error: 'clanker_force_v4_failed', provider: 'uniswap-v4' });
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'v4',
                    reason: !v4Best.pool
                        ? 'pool_unavailable'
                        : (v4Best.amountOut <= 0n ? 'quote_unavailable' : 'quote_below_threshold'),
                    amountOut: v4Best.amountOut.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v3') {
                if (!strategy.dex || (strategy.dex !== 'uniswap' && strategy.dex !== 'pancake')) continue;
                const v3Pool = await pickBestPool(pools, 'v3', chainId, strategy.dex);
                if (!v3Pool) continue;
                const v3Quote = turboMode ? 1n : await getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, strategy.dex);
                if (v3Quote > 0n && v3Quote >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: `v3:${strategy.dex}`,
                        amountOut: v3Quote.toString(),
                        minReasonable: minReasonable.toString(),
                        pool: v3Pool.poolAddress,
                        fee: v3Pool.fee
                    });
                    return finish(await executeV3Swap(normalizedParams, v3Pool, strategy.dex, { fastMode: turboMode, executionMode: requestedMode }));
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: `v3:${strategy.dex}`,
                    reason: 'quote_below_threshold',
                    amountOut: v3Quote.toString(),
                    minReasonable: minReasonable.toString(),
                    pool: v3Pool.poolAddress
                });
                continue;
            }

            if (strategy.kind === 'zora-sdk') {
                if (chainId !== 8453) continue;
                // In no-reference mode, avoid slow Zora API fallback unless source explicitly hints Zora-like flow.
                if (referenceQuote <= 0n && !zoraLikely) {
                    logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy skipped', {
                        strategy: 'zora-sdk',
                        reason: 'no_reference_and_not_zora_likely'
                    });
                    continue;
                }
                const zoraQuote = await getZoraSdkExpectedOutput({
                    tokenIn: normalizedTokenIn,
                    tokenOut: normalizedTokenOut,
                    amountInWei,
                    chainId,
                    recipient: params.walletAddress
                }, {
                    zoraQuoteTimeoutMs: ZORA_QUOTE_TIMEOUT_MS,
                    createZoraQuoteWithRetry: (payload: any) => createZoraQuoteWithRetry(payload, {
                        zoraService,
                        retryCount: ZORA_RETRY_COUNT
                    }),
                    withTimeout
                });
                if (zoraQuote > 0n && zoraQuote >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'zora-sdk',
                        amountOut: zoraQuote.toString(),
                        minReasonable: minReasonable.toString()
                    });
                    const zoraResult = await executeZoraSdkSwap(normalizedParams, {
                        createZoraQuoteWithRetry: (payload: any) => createZoraQuoteWithRetry(payload, {
                            zoraService,
                            retryCount: ZORA_RETRY_COUNT
                        }),
                        sendTransaction,
                        getTxExecutionProfile
                    });
                    if (zoraResult.success) {
                        return finish(zoraResult);
                    }
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Zora strategy execution failed, trying next strategy', {
                        chainId,
                        error: zoraResult.error
                    });
                    continue;
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'zora-sdk',
                    reason: 'quote_below_threshold',
                    amountOut: zoraQuote.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'virtual-bridge') {
                if (chainId !== 8453) continue;
                const virtualToken = VIRTUAL_TOKEN_ADDRESSES[chainId];
                if (!virtualToken) continue;
                const bridgeQuote = await getV3BridgeQuoteOut(
                    poolTokenIn,
                    virtualToken,
                    poolTokenOut,
                    amountInWei,
                    chainId,
                    'uniswap'
                );
                const quotedOut = bridgeQuote?.amountOut || 0n;
                if (bridgeQuote && quotedOut > 0n && quotedOut >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'virtual-bridge',
                        amountOut: quotedOut.toString(),
                        minReasonable: minReasonable.toString(),
                        feeInToVirtual: bridgeQuote.feeInToBridge,
                        feeVirtualToOut: bridgeQuote.feeBridgeToOut
                    });
                    return finish(await executeV3VirtualBridgeSwap(
                        normalizedParams,
                        virtualToken,
                        bridgeQuote,
                        {
                            callRpc,
                            sendTransaction,
                            getTxExecutionProfile,
                            wethAddresses: WETH_ADDRESSES
                        }
                    ));
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'virtual-bridge',
                    reason: !bridgeQuote ? 'quote_unavailable' : 'quote_below_threshold',
                    amountOut: quotedOut.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'aerodrome') {
                if (chainId !== 8453) continue;
                if (isBuySideStableOrNativeIn(chainId, normalizedTokenIn)) {
                    const aeroDepth = evaluateAerodromeBuySideDepthFromPoolLayer(pools, poolTokenIn, amountInWei);
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Aerodrome depth gate (strategy)', {
                        chainId,
                        strategy: 'aerodrome',
                        checkedPools: aeroDepth.checkedPools,
                        matchedPools: aeroDepth.matchedPools,
                        requiredReserveInWei: aeroDepth.requiredReserveInWei.toString().slice(0, 20),
                        multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                        allowed: aeroDepth.eligible
                    });
                    if (!aeroDepth.eligible) {
                        logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                            strategy: 'aerodrome',
                            reason: 'insufficient_liquidity_depth',
                            checkedPools: aeroDepth.checkedPools,
                            matchedPools: aeroDepth.matchedPools
                        });
                        continue;
                    }
                }
                const aeroQuote = await getAerodromeExpectedOutput(
                    normalizedTokenIn,
                    normalizedTokenOut,
                    amountInWei,
                    chainId,
                    params.slippageBps,
                    params.walletAddress
                );
                if (aeroQuote > 0n && aeroQuote >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'aerodrome',
                        amountOut: aeroQuote.toString(),
                        minReasonable: minReasonable.toString()
                    });
                    return finish(await executeAerodromeSwap(normalizedParams));
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'aerodrome',
                    reason: 'quote_below_threshold',
                    amountOut: aeroQuote.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v2') {
                const v2Pool = await pickBestPool(pools, 'v2', chainId, strategy.dex);
                if (!v2Pool) continue;
                const v2Quote = await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (v2Quote > 0n && v2Quote >= minReasonable) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: `v2:${strategy.dex || 'uniswap'}`,
                        amountOut: v2Quote.toString(),
                        minReasonable: minReasonable.toString(),
                        pool: v2Pool.poolAddress
                    });
                    return finish(await executeV2Swap(normalizedParams, v2Quote));
                }
                logger.debug(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: `v2:${strategy.dex || 'uniswap'}`,
                    reason: 'quote_below_threshold',
                    amountOut: v2Quote.toString(),
                    minReasonable: minReasonable.toString(),
                    pool: v2Pool.poolAddress
                });
                continue;
            }
        }

        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] No strategy matched threshold', {
            traceId,
            chainId,
            tokenIn: normalizedTokenIn,
            tokenOut: normalizedTokenOut,
            referenceQuote: referenceQuote.toString(),
            minReasonable: minReasonable.toString(),
            strategiesTried: strategies.map(s => `${s.kind}${s.dex ? `:${s.dex}` : ''}`)
        });
        return finish({ success: false, error: 'No suitable pool found', provider: 'failed' });
    } catch (error: any) {
        const errSummary = summarizeRpcError(error);
        logger.error(LogCode.EXE_TX_REVERTED, '[DirectSwap] Direct swap failed', {
            error: error.message,
            errorCode: errSummary.code,
            revertReason: errSummary.reason,
            errorData: errSummary.dataPreview,
            stack: error.stack?.slice(0, 200),
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12)
        });
        return finish({
            success: false,
            error: error.message,
            provider: 'failed'
        });
    }
}

/**
 * 执行 Aerodrome 交易 (Base)
 */
async function executeAerodromeSwap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        amountInWei: bigint;
        chainId: number;
        slippageBps: number;
        mevProtection?: boolean;
    }
): Promise<DirectSwapResult> {
    try {
        const amountInWei = params.amountInWei;
        const quoteBuild = await buildAerodromeSwapTransaction({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: amountInWei,
            recipient: params.walletAddress,
            slippageBps: params.slippageBps
        }, params.chainId);

        if (!quoteBuild) {
            return { success: false, error: 'Aerodrome quote not available', provider: 'failed' };
        }

        const { swapTx } = quoteBuild;

        // Gas estimate with buffer
        let gasLimit: string;
        try {
            const estimate = await callRpc<string>(params.chainId, 'eth_estimateGas', [{
                from: params.walletAddress,
                to: swapTx.to,
                data: swapTx.data,
                value: swapTx.value ? ethers.toBeHex(BigInt(swapTx.value)) : '0x0'
            }]);
            const estimatedGas = BigInt(estimate);
            gasLimit = (estimatedGas * 2n).toString();
        } catch {
            gasLimit = '400000';
        }

        const txHash = await sendTransaction(params.userId, params.accessToken, {
            to: swapTx.to,
            data: swapTx.data,
            value: swapTx.value || '0',
            chainId: params.chainId,
            txPurpose: 'trade',
            mevProtection: params.mevProtection === true,
            executionProfile: getTxExecutionProfile(params.chainId),
            gas: gasLimit
        });

        return {
            success: true,
            txHash,
            provider: 'aerodrome'
        };
    } catch (error: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Aerodrome swap failed', {
            error: error.message?.slice(0, 120)
        });
        return { success: false, error: error.message, provider: 'failed' };
    }
}


export { isDirectSwapSupported };
