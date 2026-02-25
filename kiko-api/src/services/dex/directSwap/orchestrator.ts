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
import { getTokenMetadata } from '../../rpcService.js';
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
    getCachedV4GasLimit as getCachedV4GasLimitFromCache,
    setCachedV4GasLimit as setCachedV4GasLimitInCache,
    getCachedWinningStrategy as getCachedWinningStrategyFromCache,
    setCachedWinningStrategy as setCachedWinningStrategyInCache,
    getCachedSinglePoolWinnerHint as getCachedSinglePoolWinnerHintFromCache,
    setCachedSinglePoolWinnerHint as setCachedSinglePoolWinnerHintInCache,
    isFreshNoPoolCache as isFreshNoPoolCacheFromCache,
    setNoPoolCache as setNoPoolCacheInCache,
    clearNoPoolCache as clearNoPoolCacheInCache,
    v4GasCacheKey,
} from './cache.js';
import { executeV2Swap as executeV2SwapExecutor } from './executors/v2.js';
import { executeV3Swap as executeV3SwapExecutor } from './executors/v3.js';
import { executeV4Swap as executeV4SwapExecutor } from './executors/v4.js';
import { executeInfinitySwap as executeInfinitySwapExecutor } from './executors/infinity.js';
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
    buildTurboSinglePoolAttemptPlan,
    capTurboRescueCandidatePools,
    isLikelyAerodromeHintTrustworthy
} from './domain/candidatePlan.js';
import type { TurboRescueInternalStrategyKind } from './domain/candidatePlan.js';
import { parseAmountInWeiByToken } from './domain/amount.js';
import {
    classifyFailure,
    isTransientRpcFailureForPreSim,
    shouldSkipResolvedHintRetry,
    summarizeRpcError
} from './domain/failure.js';
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

// 常用代币地址
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006', // Base
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',    // Ethereum
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // BSC (WBNB)
};

const USDC_ADDRESSES: Record<number, string> = {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
    56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',    // BSC (USDC)
};

const ZORA_TOKEN_ADDRESSES: Record<number, string> = {
    8453: '0x1111111111166b7fe7bd91427724b487980afc69'
};
const VIRTUAL_TOKEN_ADDRESSES: Record<number, string> = {
    8453: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'
};

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
const DIRECT_SWAP_FASTPATH_BUDGET_MS = Number(process.env.DIRECT_SWAP_FASTPATH_BUDGET_MS || '3500');
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

const STABLE_TOKEN_HINTS_BY_CHAIN: Record<number, string[]> = {
    1: [
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
        '0x6b175474e89094c44da98b954eedeac495271d0f'  // DAI
    ],
    8453: [
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
        '0xfde4c96c8593536e31f229ea8f37b2adab90b239', // USDT
        '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'  // DAI
    ],
    56: [
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
        '0x55d398326f99059ff775485246999027b3197955', // USDT
        '0xe9e7cea3dedca5984780bafc599bd69add087d56'  // BUSD
    ],
    137: [
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'  // USDT
    ],
    42161: [
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  // USDT
    ],
    10: [
        '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
        '0x94b008aa00579c1307b0ef2b499ad98a8ce58e58'  // USDT
    ]
};

const TURBO_USD_DEPTH_TIERS: Array<{ maxUsd: number; multiplier: number }> = [
    { maxUsd: 100, multiplier: 100 },
    { maxUsd: 1000, multiplier: 60 },
    { maxUsd: 5000, multiplier: 30 },
    { maxUsd: Number.POSITIVE_INFINITY, multiplier: 15 }
];
const DIRECT_SWAP_BUY_LIQ_MULTIPLIER = Number(process.env.DIRECT_SWAP_BUY_LIQ_MULTIPLIER || '100');
const COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS = Math.max(1, Number(process.env.COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS || '7000'));

function createDirectSwapTraceId(chainId: number, hint?: DirectSwapHint): string {
    const source = (hint?.sourceTxHash || 'nohint').slice(2, 10);
    return `${chainId}-${source}-${Date.now().toString(36).slice(-6)}`;
}

function providerToStrategy(provider: DirectSwapResult['provider'], chainId: number): DexStrategy | null {
    switch (provider) {
        case 'uniswap-v4':
            return { kind: 'v4', dex: chainId === 56 ? 'pancake' : 'uniswap' };
        case 'pancake-infinity':
            return { kind: 'infinity', dex: 'pancake-infinity' };
        case 'uniswap-v3':
            return { kind: 'v3', dex: 'uniswap' };
        case 'pancake-v3':
            return { kind: 'v3', dex: 'pancake' };
        case 'uniswap-v2':
            return { kind: 'v2', dex: 'uniswap' };
        case 'pancake-v2':
            return { kind: 'v2', dex: 'pancake' };
        case 'aerodrome':
            return { kind: 'aerodrome', dex: 'aerodrome' };
        case 'zora-sdk':
            return { kind: 'zora-sdk', dex: 'uniswap' };
        default:
            return null;
    }
}

function getCachedV4GasLimit(key: string): string | null {
    return getCachedV4GasLimitFromCache(key, DIRECT_SWAP_GAS_CACHE_TTL_MS);
}

function setCachedV4GasLimit(key: string, gasLimit: string): void {
    setCachedV4GasLimitInCache(key, gasLimit);
}

async function getCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string): Promise<DexStrategy | null> {
    return await getCachedWinningStrategyFromCache(
        chainId,
        tokenIn,
        tokenOut,
        WINNING_ROUTE_CACHE_TTL_MS * 1000
    );
}

async function setCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string, strategy: DexStrategy): Promise<void> {
    await setCachedWinningStrategyInCache(
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
    return await getCachedSinglePoolWinnerHintFromCache(
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
    await setCachedSinglePoolWinnerHintInCache(
        chainId,
        tokenIn,
        tokenOut,
        hint,
        WINNING_ROUTE_CACHE_TTL_MS
    );
}

async function isFreshNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): Promise<boolean> {
    return await isFreshNoPoolCacheFromCache(chainId, tokenIn, tokenOut, NO_POOL_CACHE_TTL_MS);
}

function setNoPoolCache(chainId: number, tokenIn: string, tokenOut: string, reason: string): void {
    setNoPoolCacheInCache(chainId, tokenIn, tokenOut, reason, NO_POOL_CACHE_TTL_MS);
}

function clearNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): void {
    clearNoPoolCacheInCache(chainId, tokenIn, tokenOut);
}

function getTxExecutionProfile(chainId: number): 'default' | 'base-sniper' | 'bsc-sniper' {
    if (chainId === 8453) return 'base-sniper';
    if (chainId === 56) return 'bsc-sniper';
    return 'default';
}

async function pickBestPool(
    pools: PoolInfo[],
    version: PoolInfo['version'],
    chainId: number,
    dex?: DexFamily
): Promise<PoolInfo | null> {
    return await pickBestPoolByLiveSnapshot({ pools, version, chainId, dex });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
        promise.then(val => {
            clearTimeout(timer);
            resolve(val);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function withAbortableTimeout<T>(
    runner: (signal: AbortSignal) => Promise<T>,
    ms: number
): Promise<T> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    try {
        return await Promise.race([
            runner(controller.signal),
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error(`timeout_${ms}ms`));
                }, ms);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

// Delegates to the single source of truth for native prices (10-min cache, multi-source fallback)
async function getNativePriceUsd(chainId: number): Promise<number> {
    return getNativeTokenPriceUsd(chainId).catch(() => 0);
}

function getChainSlugForUsdLookup(chainId: number): string {
    if (chainId === 8453) return 'base';
    if (chainId === 1) return 'eth';
    if (chainId === 56) return 'bsc';
    if (chainId === 137) return 'polygon';
    if (chainId === 42161) return 'arbitrum';
    if (chainId === 10) return 'optimism';
    return '';
}

function isStableTokenAddress(chainId: number, tokenAddress: string): boolean {
    const normalized = tokenAddress.toLowerCase();
    return (STABLE_TOKEN_HINTS_BY_CHAIN[chainId] || []).includes(normalized);
}

function pickDepthMultiplierByUsd(effectiveAmountUsd: number): number {
    if (!Number.isFinite(effectiveAmountUsd) || effectiveAmountUsd <= 0) {
        return TURBO_USD_DEPTH_TIERS[0].multiplier;
    }
    for (const tier of TURBO_USD_DEPTH_TIERS) {
        if (effectiveAmountUsd <= tier.maxUsd) return tier.multiplier;
    }
    return TURBO_USD_DEPTH_TIERS[TURBO_USD_DEPTH_TIERS.length - 1].multiplier;
}

function isBuySideStableOrNativeIn(chainId: number, tokenIn: string): boolean {
    const normalized = tokenIn.toLowerCase();
    const nativePseudo = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const wrappedNative = (WETH_ADDRESSES[chainId] || '').toLowerCase();
    if (normalized === nativePseudo) return true;
    if (wrappedNative && normalized === wrappedNative) return true;
    return isStableTokenAddress(chainId, normalized);
}

interface TurboRescueStepResult {
    selectedKind?: TurboRescueInternalStrategyKind;
    success: boolean;
    error?: string;
}

async function evaluateResolvedHintFastPathLiquidityGate(params: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    resolvedHint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
    budgetMs: number;
}): Promise<HintLiquidityGateResult> {
    if (params.budgetMs <= 80) {
        return {
            allowed: false,
            reason: 'hint_liquidity_gate_budget_exhausted',
            blockType: 'uncertain_block',
            poolCount: 0,
            matchingPoolCount: 0,
            matchingEligibleCount: 0,
            requiredReserveInWei: '0'
        };
    }

    let pools: PoolInfo[] = [];
    let poolDiscoveryFailed = false;
    try {
        pools = await withTimeout(
            findTokenPools(params.tokenIn, params.tokenOut, params.chainId),
            params.budgetMs
        );
    } catch {
        poolDiscoveryFailed = true;
        pools = [];
    }

    if (poolDiscoveryFailed) {
        return {
            allowed: false,
            reason: 'hint_liquidity_gate_discovery_failed',
            blockType: 'uncertain_block',
            poolCount: 0,
            matchingPoolCount: 0,
            matchingEligibleCount: 0,
            requiredReserveInWei: '0'
        };
    }

    if (pools.length === 0) {
        return {
            allowed: false,
            reason: 'hint_liquidity_gate_no_pools',
            blockType: 'uncertain_block',
            poolCount: 0,
            matchingPoolCount: 0,
            matchingEligibleCount: 0,
            requiredReserveInWei: '0'
        };
    }

    return evaluateResolvedHintFastPathLiquidityGateFromPools({
        pools,
        tokenIn: params.tokenIn,
        amountInWei: params.amountInWei,
        resolvedHint: params.resolvedHint,
        multiplier: Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
    });
}

function evaluateAerodromeBuySideDepth(
    pools: PoolInfo[],
    tokenIn: string,
    amountInWei: bigint
): {
    eligible: boolean;
    requiredReserveInWei: bigint;
    checkedPools: number;
    matchedPools: number;
} {
    const aerodromePools = pools.filter((pool) => {
        const version = String(pool.version || '').toLowerCase();
        const dex = String(pool.dex || '').toLowerCase();
        return version === 'aerodrome' || dex === 'aerodrome';
    });
    const guard = evaluateBuyLiquidityProtection(
        aerodromePools,
        tokenIn,
        amountInWei,
        Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
    );
    return {
        eligible: guard.eligible,
        requiredReserveInWei: guard.requiredReserveInWei,
        checkedPools: guard.checkedPools,
        matchedPools: guard.matchedPools
    };
}

async function estimateAmountUsdByToken(
    chainId: number,
    tokenAddress: string,
    amountInWei: bigint
): Promise<number> {
    if (amountInWei <= 0n) return 0;
    const normalized = tokenAddress.toLowerCase();
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const wrappedNative = WETH_ADDRESSES[chainId]?.toLowerCase();

    if (normalized === ETH_ADDRESS || (wrappedNative && normalized === wrappedNative)) {
        const nativePrice = await getNativePriceUsd(chainId);
        if (nativePrice > 0) {
            return Number(ethers.formatUnits(amountInWei, 18)) * nativePrice;
        }
    }

    if (isStableTokenAddress(chainId, normalized)) {
        const decimals = (await getTokenMetadata(chainId, tokenAddress).catch(() => ({ decimals: 18 }))).decimals || 18;
        return Number(ethers.formatUnits(amountInWei, decimals));
    }

    try {
        const chainSlug = getChainSlugForUsdLookup(chainId);
        if (!chainSlug) return 0;
        const [meta, tokenDetails] = await withTimeout(
            Promise.all([
                getTokenMetadata(chainId, tokenAddress),
                getTokenDetails(chainSlug, tokenAddress, 'high')
            ]),
            900
        );
        const priceUsd = Number(tokenDetails?.price || 0);
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
        const decimals = meta?.decimals || 18;
        return Number(ethers.formatUnits(amountInWei, decimals)) * priceUsd;
    } catch {
        return 0;
    }
}

/**
 * 获取代币的流动性信息
 * [Logic]: 查询所有 V2/V3/V4 池子并计算 TVL
 */
export async function getTokenLiquidity(
    tokenAddress: string,
    chainId: number
): Promise<TokenLiquidity> {
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) {
        return { totalTvlUsd: 0, pools: [] };
    }

    try {
        const pools = await findTokenPools(tokenAddress, weth, chainId);
        const result: TokenLiquidity = { totalTvlUsd: 0, pools: [] };

        for (const pool of pools) {
            let tvlUsd = 0;

            // 计算 TVL
            if (pool.liquidity && pool.sqrtPriceX96) {
                const isToken0 = pool.token0.toLowerCase() === tokenAddress.toLowerCase();
                const decimals0 = pool.token0Decimals || 18;
                const decimals1 = pool.token1Decimals || 18;

                // WETH 价格 (live from geckoTerminal, cached 60s)
                const nativePriceUsd = await getNativePriceUsd(chainId);
                const price0USD = isToken0 ? 0 : nativePriceUsd;
                const price1USD = isToken0 ? nativePriceUsd : 0;

                tvlUsd = calculateV3TVL(
                    BigInt(pool.sqrtPriceX96),
                    BigInt(pool.liquidity),
                    decimals0,
                    decimals1,
                    price0USD,
                    price1USD
                );
            }

            result.pools.push({
                version: pool.version || 'v3',
                fee: pool.fee || 0,
                tvlUsd,
                address: pool.poolAddress
            });
            result.totalTvlUsd += tvlUsd;
        }

        return result;
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to get token liquidity', {
            token: tokenAddress,
            error: error.message
        });
        return { totalTvlUsd: 0, pools: [] };
    }
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

async function readPoolPairTokens(chainId: number, poolAddress: string): Promise<{ token0: string; token1: string } | null> {
    if (!poolAddress || !/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) return null;
    try {
        const [token0Hex, token1Hex] = await Promise.all([
            callRpc<string>(
                chainId,
                'eth_call',
                [{ to: poolAddress, data: poolTokenInterface.encodeFunctionData('token0', []) }, 'latest'],
                { strategy: 'fast', importance: 'critical' }
            ),
            callRpc<string>(
                chainId,
                'eth_call',
                [{ to: poolAddress, data: poolTokenInterface.encodeFunctionData('token1', []) }, 'latest'],
                { strategy: 'fast', importance: 'critical' }
            )
        ]);
        const token0 = ethers.getAddress(`0x${token0Hex.slice(-40)}`).toLowerCase();
        const token1 = ethers.getAddress(`0x${token1Hex.slice(-40)}`).toLowerCase();
        return { token0, token1 };
    } catch {
        return null;
    }
}

async function validateResolvedHintAgainstSwapPair(
    params: {
        tokenIn: string;
        tokenOut: string;
        chainId: number;
    },
    hint: DirectSwapHint['resolvedPoolHint']
): Promise<{ ok: boolean; reason?: string; details?: Record<string, string | number | null> }> {
    if (!hint) return { ok: false, reason: 'missing_hint' };

    if (hint.kind === 'aerodrome') {
        // Aerodrome execution path is router-quoted and not bound to a single pool address.
        return { ok: true };
    }

    if (hint.kind === 'v4' && hint.v4PoolKey) {
        const pairOk = isSameHintPair(
            params.tokenIn,
            params.tokenOut,
            hint.v4PoolKey.currency0,
            hint.v4PoolKey.currency1,
            WETH_ADDRESSES[params.chainId]
        );
        return pairOk
            ? { ok: true }
            : {
                ok: false,
                reason: 'v4_pair_mismatch',
                details: {
                    swapTokenIn: params.tokenIn,
                    swapTokenOut: params.tokenOut,
                    poolToken0: hint.v4PoolKey.currency0,
                    poolToken1: hint.v4PoolKey.currency1,
                    poolAddress: hint.poolAddress || null
                }
            };
    }

    if ((hint.kind === 'v3' || hint.kind === 'v2') && hint.poolAddress) {
        const poolTokens = await readPoolPairTokens(params.chainId, hint.poolAddress.toLowerCase());
        if (!poolTokens) {
            return {
                ok: false,
                reason: 'pool_tokens_unavailable',
                details: { poolAddress: hint.poolAddress.toLowerCase() }
            };
        }
        const pairOk = isSameHintPair(
            params.tokenIn,
            params.tokenOut,
            poolTokens.token0,
            poolTokens.token1,
            WETH_ADDRESSES[params.chainId]
        );
        return pairOk
            ? { ok: true }
            : {
                ok: false,
                reason: 'pool_pair_mismatch',
                details: {
                    swapTokenIn: params.tokenIn,
                    swapTokenOut: params.tokenOut,
                    poolToken0: poolTokens.token0,
                    poolToken1: poolTokens.token1,
                    poolAddress: hint.poolAddress.toLowerCase()
                }
            };
    }

    return { ok: false, reason: 'unsupported_hint_shape' };
}

async function tryResolvedPoolHintFastPath(
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
    },
    hint?: DirectSwapHint,
    options?: { executionMode?: DirectSwapExecutionMode; trustedHint?: boolean }
): Promise<DirectSwapResult | null> {
    const resolved = hint?.resolvedPoolHint;
    if (!resolved) return null;
    const sourceAnchor = resolveSourceAnchorExpectation({
        hint,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountInWei: params.amountInWei,
        wrappedNativeAddress: WETH_ADDRESSES[params.chainId] || '',
        minAnchorRatioBps: COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS
    });

    const validation = await validateResolvedHintAgainstSwapPair(
        {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            chainId: params.chainId
        },
        resolved
    );
    if (!validation.ok) {
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Skip resolved pool hint: pair validation failed', {
            chainId: params.chainId,
            reason: validation.reason,
            details: validation.details || null
        });
        return {
            success: false,
            error: `hint_pool_pair_mismatch:${validation.reason || 'unknown'}`,
            provider: 'failed'
        };
    }

    if (resolved.kind === 'v4' && resolved.v4PoolKey) {
        let poolKey = {
            currency0: resolved.v4PoolKey.currency0,
            currency1: resolved.v4PoolKey.currency1,
            hooks: resolved.v4PoolKey.hooks,
            fee: resolved.v4PoolKey.fee,
            tickSpacing: resolved.v4PoolKey.tickSpacing
        };

        // If hooks/tickSpacing are missing OR pool pair appears misaligned,
        // resolve PoolKey by poolId to recover the exact on-chain key.
        const pairAligned = isSameHintPair(
            params.tokenIn,
            params.tokenOut,
            poolKey.currency0,
            poolKey.currency1,
            WETH_ADDRESSES[params.chainId]
        );
        const isIncomplete = poolKey.hooks === '0x0000000000000000000000000000000000000000'
            && poolKey.tickSpacing <= 0;
        if ((isIncomplete || !pairAligned) && resolved.poolAddress) {
            const resolvedKey = matchV4PoolKeyById(
                params.chainId,
                resolved.poolAddress,
                normalizePairTokenForHint(params.tokenIn, WETH_ADDRESSES[params.chainId]),
                normalizePairTokenForHint(params.tokenOut, WETH_ADDRESSES[params.chainId]),
                poolKey.hooks
            );
            if (resolvedKey) {
                poolKey = {
                    currency0: resolvedKey.currency0,
                    currency1: resolvedKey.currency1,
                    hooks: resolvedKey.hooks,
                    fee: resolvedKey.fee,
                    tickSpacing: resolvedKey.tickSpacing
                };
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Recovered V4 pool key from poolId', {
                    chainId: params.chainId,
                    poolAddress: resolved.poolAddress,
                    reason: isIncomplete ? 'incomplete_hint' : 'pair_realign',
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut
                });
            }
        }

        const selectedPool: SelectedV4Pool = {
            poolId: resolved.poolAddress || '',
            poolAddress: resolved.poolAddress || '',
            poolKey,
            sqrtPriceX96: '0',
            fee: poolKey.fee,
            liquidity: '0'
        };
        return executeV4Swap(params, selectedPool, {
            allowZeroQuoteMinOut: true,
            fastMode: true,
            executionMode: options?.executionMode,
            trustedHint: options?.trustedHint
        });
    }

    if (resolved.kind === 'aerodrome' || resolved.dex === 'aerodrome') {
        if (!isLikelyAerodromeHintTrustworthy(hint)) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Hint fast-path Aerodrome rejected: untrusted source hint', {
                poolAddress: resolved.poolAddress,
                chainId: params.chainId,
                sourceDex: hint?.sourceDexName || null
            });
            return {
                success: false,
                error: 'hint_fastpath_disallowed:aerodrome_untrusted_source',
                provider: 'failed'
            };
        }
        if (params.chainId === 8453 && options?.executionMode === 'turbo') {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Hint fast-path Aerodrome deferred in Base turbo', {
                poolAddress: resolved.poolAddress,
                chainId: params.chainId,
                reason: 'prefer_v4_v3_v2_before_aero'
            });
            return {
                success: false,
                error: 'hint_fastpath_disallowed:aerodrome_turbo_deferred',
                provider: 'failed'
            };
        }
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Hint fast-path routing to Aerodrome', {
            poolAddress: resolved.poolAddress,
            chainId: params.chainId
        });
        return executeAerodromeSwap(params);
    }

    if ((resolved.kind === 'v3' || resolved.kind === 'v2') && resolved.poolAddress) {
        const pool: PoolInfo = {
            poolAddress: resolved.poolAddress,
            token0: params.tokenIn,
            token1: params.tokenOut,
            fee: resolved.fee || 0,
            version: resolved.kind,
            dex: resolved.dex === 'pancake' ? 'pancake' : 'uniswap'
        };
        if (resolved.kind === 'v3') {
            const dex = resolved.dex === 'pancake' ? 'pancake' : 'uniswap';
            return executeV3Swap(params, pool, dex, {
                fastMode: true,
                executionMode: options?.executionMode
            });
        }
        const expectedOut = await getV2ExpectedOutput(params.tokenIn, params.tokenOut, params.amountInWei, params.chainId);
        if (expectedOut <= 0n) {
            return { success: false, error: 'Resolved V2 pool quote unavailable', provider: 'failed' };
        }
        if (sourceAnchor) {
            const anchorCheck = evaluateSourceAnchorQuote(expectedOut, sourceAnchor);
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (resolved fast-path)', {
                chainId: params.chainId,
                kind: resolved.kind,
                sourceTxHash: sourceAnchor.sourceTxHash || null,
                quotedOut: expectedOut.toString(),
                expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
                anchorRatioBps: anchorCheck.ratioBps,
                minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
                anchorAccepted: anchorCheck.accepted
            });
            if (!anchorCheck.accepted) {
                return {
                    success: false,
                    error: `source_anchor_guard_reject:v2:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`,
                    provider: 'failed'
                };
            }
        }
        return executeV2Swap(params, expectedOut);
    }

    return null;
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

    const swapStart = Date.now();
    let tPoolDiscoveryDone = 0;
    let tStrategyStart = 0;
    let tExecutionStart = 0;
    let poolCacheTokenIn = normalizedTokenIn;
    let poolCacheTokenOut = normalizedTokenOut;
    let selectedResolvedHintForCache: ResolvedPoolHint | null = null;
    const finish = async (result: DirectSwapResult): Promise<DirectSwapResult> => {
        const durationMs = Date.now() - swapStart;
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
            result.error = `${reasonCode}: ${result.error}`;
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
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Finished', {
            traceId,
            provider: result.provider,
            success: result.success,
            durationMs,
            timelineMs: {
                poolDiscovery: tPoolDiscoveryDone > 0 ? tPoolDiscoveryDone - swapStart : null,
                strategyWait: (tStrategyStart > 0 && tPoolDiscoveryDone > 0) ? tStrategyStart - tPoolDiscoveryDone : null,
                executionWait: (tExecutionStart > 0 && tStrategyStart > 0) ? tExecutionStart - tStrategyStart : null,
                execution: tExecutionStart > 0 ? durationMs - tExecutionStart + swapStart : null
            }
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
        return result;
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
        const turboFastDeadline = computeTurboDeadline(swapStart, DIRECT_SWAP_FASTPATH_BUDGET_MS);
        let earlyHintedPool: HintedSourcePool | null = null;
        let resolvedHintFastPathSkipped = false;
        let resolvedHintFastPathFailed = false;
        if (params.hint?.resolvedPoolHint) {
            const hintHopCount = Math.max(
                Number(params.hint?.routeHopCount || 0),
                params.hint?.routeHops?.length || 0
            );
            const canUseResolvedFastPath = params.hint?.canUseResolvedPoolFastPath !== false && hintHopCount <= 1;
            if (!canUseResolvedFastPath) {
                resolvedHintFastPathSkipped = true;
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Resolved pool hint fast-path skipped by route context', {
                    chainId,
                    canUseResolvedPoolFastPath: params.hint?.canUseResolvedPoolFastPath,
                    routeHopCount: hintHopCount,
                    reason: 'multi_hop_or_explicitly_disabled'
                });
            } else {
                const resolvedHint = params.hint.resolvedPoolHint as NonNullable<DirectSwapHint['resolvedPoolHint']>;
                let liquidityGateBlocked = false;
                if (isBuySideStableOrNativeIn(chainId, normalizedTokenIn)) {
                    const gateBudgetMs = turboMode
                        ? Math.max(180, Math.min(DIRECT_SWAP_HINT_POOL_TIMEOUT_MS, turboFastDeadline - Date.now()))
                        : Math.min(1200, DIRECT_SWAP_HINT_POOL_TIMEOUT_MS);
                    const gate = await evaluateResolvedHintFastPathLiquidityGate({
                        chainId,
                        tokenIn: poolTokenIn,
                        tokenOut: poolTokenOut,
                        amountInWei,
                        resolvedHint,
                        budgetMs: gateBudgetMs
                    });
                    const gateDecision: 'allow' | 'block_definitive' | 'block_uncertain_but_try' = gate.allowed
                        ? 'allow'
                        : (turboMode && gate.blockType === 'uncertain_block')
                            ? 'block_uncertain_but_try'
                            : 'block_definitive';
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved hint liquidity gate', {
                        chainId,
                        traceId,
                        mode: requestedMode,
                        kind: resolvedHint.kind,
                        dex: resolvedHint.dex || null,
                        poolAddress: resolvedHint.poolAddress || null,
                        resolvedHintKind: resolvedHint.kind,
                        gateAllowed: gate.allowed,
                        gateDecision,
                        gateReason: gate.reason,
                        gateBlockType: gate.blockType,
                        gateBudgetMs,
                        poolCount: gate.poolCount,
                        matchingPoolCount: gate.matchingPoolCount,
                        matchingEligibleCount: gate.matchingEligibleCount,
                        requiredReserveInWei: gate.requiredReserveInWei.slice(0, 20),
                        multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER
                    });
                    if (!gate.allowed && !(turboMode && gate.blockType === 'uncertain_block')) {
                        liquidityGateBlocked = true;
                        resolvedHintFastPathSkipped = true;
                        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Resolved pool hint fast-path skipped by liquidity gate', {
                            chainId,
                            traceId,
                            gateDecision,
                            gateReason: gate.reason,
                            gateBlockType: gate.blockType,
                            kind: resolvedHint.kind,
                            dex: resolvedHint.dex || null,
                            poolAddress: resolvedHint.poolAddress || null
                        });
                    } else if (!gate.allowed && turboMode && gate.blockType === 'uncertain_block') {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved pool hint gate uncertain in turbo - still attempting fast-path', {
                            chainId,
                            traceId,
                            gateReason: gate.reason,
                            gateBlockType: gate.blockType,
                            kind: resolvedHint.kind,
                            dex: resolvedHint.dex || null,
                            poolAddress: resolvedHint.poolAddress || null
                        });
                    }
                }

                if (!liquidityGateBlocked) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint attempt', {
                        chainId,
                        kind: resolvedHint.kind,
                        dex: resolvedHint.dex,
                        poolAddress: resolvedHint.poolAddress
                    });

                    const directTry = await tryResolvedPoolHintFastPath(
                        normalizedParams,
                        params.hint,
                        { executionMode: requestedMode, trustedHint: turboMode }
                    );
                    if (directTry?.success) {
                        if (params.hint?.resolvedPoolHint?.poolAddress) {
                            selectedResolvedHintForCache = params.hint.resolvedPoolHint as ResolvedPoolHint;
                        }
                        return finish(directTry);
                    }
                    resolvedHintFastPathFailed = Boolean(directTry && !directTry.success);

                    // Balanced mode: one cheap hint attempt then continue normal flow.
                    if (!turboMode) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved pool hint unavailable in normal mode, continue discovery', {
                            chainId,
                            error: directTry?.error
                        });
                    } else {
                        if (shouldSkipResolvedHintRetry(directTry?.error)) {
                            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint failed, skip retry for non-retryable hint failure', {
                                chainId,
                                error: directTry?.error
                            });
                        } else {
                            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint failed, retry once', {
                                chainId,
                                error: directTry?.error
                            });
                            const retryTry = await tryResolvedPoolHintFastPath(
                                normalizedParams,
                                params.hint,
                                { executionMode: requestedMode, trustedHint: true }
                            );
                            if (retryTry?.success) {
                                if (params.hint?.resolvedPoolHint?.poolAddress) {
                                    selectedResolvedHintForCache = params.hint.resolvedPoolHint as ResolvedPoolHint;
                                }
                                return finish(retryTry);
                            }
                            resolvedHintFastPathFailed = resolvedHintFastPathFailed || Boolean(retryTry && !retryTry.success);
                        }

                        if (isTurboBudgetExceeded(swapStart, DIRECT_SWAP_FASTPATH_BUDGET_MS)) {
                            return finish({
                                success: false,
                                error: 'Fast-path budget exceeded after resolved-pool attempts',
                                provider: 'failed'
                            });
                        }
                    }
                }
            }
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
                const rescueOrder = buildTurboRescueOrder(chainId);
                const sourceAnchor = resolveSourceAnchorExpectation({
                    hint: params.hint,
                    tokenIn: normalizedParams.tokenIn,
                    tokenOut: normalizedParams.tokenOut,
                    amountInWei,
                    wrappedNativeAddress: WETH_ADDRESSES[chainId] || '',
                    minAnchorRatioBps: COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS
                });
                const remainingBudgetMs = turboFastDeadline - Date.now();
                if (remainingBudgetMs <= 80) {
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue skipped: budget exhausted', {
                        traceId,
                        chainId,
                        reason,
                        turboOrder: rescueOrder.join(' -> '),
                        elapsedMs: Date.now() - swapStart,
                        budgetMs: DIRECT_SWAP_FASTPATH_BUDGET_MS
                    });
                    return { success: false, error: `turbo_rescue_budget_exhausted:${reason}`, provider: 'failed' };
                }

                const rescuePoolBudgetMs = Math.max(180, Math.min(DIRECT_SWAP_HINT_POOL_TIMEOUT_MS, remainingBudgetMs));
                let rescuePools: PoolInfo[] = [];
                let rescuePoolDiscoveryFailed = false;
                try {
                    rescuePools = await withTimeout(
                        findTokenPools(poolTokenIn, poolTokenOut, chainId),
                        rescuePoolBudgetMs
                    );
                } catch {
                    rescuePoolDiscoveryFailed = true;
                    rescuePools = [];
                }

                const rescueSummary = summarizePools(rescuePools);
                traceState.poolCount = rescueSummary.poolsFound;
                traceState.poolKinds = rescueSummary.poolKinds;
                traceState.l1PoolStatus = rescuePools.length > 0 ? 'ok' : 'missing';
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue pool discovery', {
                    traceId,
                    chainId,
                    reason,
                    poolCount: rescuePools.length,
                    poolKinds: rescueSummary.poolKinds,
                    poolDiscoveryFailed: rescuePoolDiscoveryFailed,
                    timeoutMs: rescuePoolBudgetMs
                });

                if (rescuePoolDiscoveryFailed) {
                    return { success: false, error: `turbo_rescue_exhausted:pool_discovery_failed:${reason}`, provider: 'failed' };
                }
                if (rescuePools.length === 0) {
                    return { success: false, error: `turbo_rescue_exhausted:no_pools_after:${reason}`, provider: 'failed' };
                }

                let candidatePools = rescuePools;
                if (isBuySideStableOrNativeIn(chainId, normalizedTokenIn)) {
                    const guard = evaluateBuyLiquidityProtection(
                        rescuePools,
                        poolTokenIn,
                        amountInWei,
                        Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
                    );
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue liquidity guard', {
                        traceId,
                        chainId,
                        algorithm: 'buy_liquidity_multiplier',
                        multiplier: DIRECT_SWAP_BUY_LIQ_MULTIPLIER,
                        requiredReserveInWei: guard.requiredReserveInWei.toString().slice(0, 20),
                        checkedPools: guard.checkedPools,
                        matchedPools: guard.matchedPools,
                        byVersion: guard.byVersion,
                        sample: guard.sample
                    });
                    candidatePools = rescuePools.filter((pool) => {
                        return poolPassesRequiredReserve(pool, poolTokenIn, guard.requiredReserveInWei);
                    });
                    if (candidatePools.length === 0) {
                        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue liquidity guard reject-all', {
                            traceId,
                            chainId,
                            reason
                        });
                        return { success: false, error: `liquidity_guard_reject_all:${reason}`, provider: 'failed' };
                    }
                }

                const candidatePoolsBeforeCap = candidatePools.length;
                candidatePools = capTurboRescueCandidatePools(
                    candidatePools,
                    rescueOrder,
                    TURBO_RESCUE_MAX_CANDIDATES_PER_KIND,
                    TURBO_RESCUE_MAX_TOTAL_CANDIDATES
                );
                let lastRescueError = `turbo_rescue_start:${reason}`;
                const stepOutcome: TurboRescueStepResult = { success: false };
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue strategy order', {
                    traceId,
                    chainId,
                    turboOrder: rescueOrder.join(' -> '),
                    candidatePoolsBeforeCap,
                    candidatePools: candidatePools.length,
                    candidateByKind: {
                        v4: candidatePools.filter((pool) => pool.version === 'v4').length,
                        v3: candidatePools.filter((pool) => pool.version === 'v3').length,
                        v2: candidatePools.filter((pool) => pool.version === 'v2').length,
                        aerodrome: candidatePools.filter((pool) => String(pool.version || '').toLowerCase() === 'aerodrome').length
                    },
                    maxPerKind: TURBO_RESCUE_MAX_CANDIDATES_PER_KIND,
                    maxTotal: TURBO_RESCUE_MAX_TOTAL_CANDIDATES
                });

                if (isV4SwapSupported(chainId)) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
                        traceId,
                        chainId,
                        strategyKind: 'v4'
                    });
                    const rescueV4Pools = candidatePools
                        .filter((p) => p.version === 'v4')
                        .map((p) => ({
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
                    if (rescueV4Pools.length > 0) {
                        const v4BudgetMs = Math.max(120, Math.min(700, turboFastDeadline - Date.now()));
                        if (v4BudgetMs > 0) {
                            const v4Best = await withTimeout(
                                getV4BestPoolQuote(
                                    poolTokenIn,
                                    poolTokenOut,
                                    amountInWei,
                                    chainId,
                                    params.walletAddress,
                                    params.hint,
                                    { preloadedPools: rescueV4Pools }
                                ),
                                v4BudgetMs
                            ).catch(() => ({ pool: null, amountOut: 0n } as { pool: SelectedV4Pool | null; amountOut: bigint }));
                            if (v4Best.pool && v4Best.amountOut > 0n) {
                                let anchorRejected = false;
                                if (sourceAnchor) {
                                    const anchorCheck = evaluateSourceAnchorQuote(v4Best.amountOut, sourceAnchor);
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v4',
                                        sourceTxHash: sourceAnchor.sourceTxHash || null,
                                        quotedOut: v4Best.amountOut.toString(),
                                        expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
                                        anchorRatioBps: anchorCheck.ratioBps,
                                        minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
                                        anchorAccepted: anchorCheck.accepted
                                    });
                                    if (!anchorCheck.accepted) {
                                        lastRescueError = `source_anchor_guard_reject:v4:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`;
                                        anchorRejected = true;
                                    }
                                }
                                if (anchorRejected) {
                                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v4',
                                        skipReason: 'source_anchor_guard_reject'
                                    });
                                } else {
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v4',
                                        selectedKind: 'v4',
                                        poolId: v4Best.pool.poolAddress,
                                        amountOut: v4Best.amountOut.toString()
                                    });
                                    const v4Result = await executeV4Swap(normalizedParams, v4Best.pool, {
                                        fastMode: true,
                                        executionMode: 'turbo'
                                    });
                                    if (v4Result.success) return v4Result;
                                    lastRescueError = v4Result.error || 'turbo_rescue_v4_failed';
                                    stepOutcome.selectedKind = 'v4';
                                    stepOutcome.success = false;
                                    stepOutcome.error = lastRescueError;
                                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v4',
                                        failureCode: classifyFailure(lastRescueError),
                                        error: lastRescueError
                                    });
                                }
                            }
                        }
                    }
                }

                const v3DexOrder: Array<'uniswap' | 'pancake'> = chainId === 56
                    ? ['pancake', 'uniswap']
                    : ['uniswap', 'pancake'];
                logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
                    traceId,
                    chainId,
                    strategyKind: 'v3',
                    v3DexOrder
                });
                for (const dex of v3DexOrder) {
                    const v3Pool = await pickBestPool(candidatePools, 'v3', chainId, dex);
                    if (!v3Pool) continue;
                    const v3QuoteBudgetMs = Math.max(120, Math.min(650, turboFastDeadline - Date.now()));
                    if (v3QuoteBudgetMs <= 0) break;
                    const v3Quote = await withTimeout(
                        getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, dex),
                        v3QuoteBudgetMs
                    ).catch(() => 0n);
                    if (v3Quote <= 0n) continue;
                    if (sourceAnchor) {
                        const anchorCheck = evaluateSourceAnchorQuote(v3Quote, sourceAnchor);
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
                            traceId,
                            chainId,
                            strategyKind: 'v3',
                            dex,
                            sourceTxHash: sourceAnchor.sourceTxHash || null,
                            quotedOut: v3Quote.toString(),
                            expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
                            anchorRatioBps: anchorCheck.ratioBps,
                            minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
                            anchorAccepted: anchorCheck.accepted
                        });
                        if (!anchorCheck.accepted) {
                            lastRescueError = `source_anchor_guard_reject:v3:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`;
                            continue;
                        }
                    }
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
                        traceId,
                        chainId,
                        strategyKind: 'v3',
                        selectedKind: 'v3',
                        dex,
                        pool: v3Pool.poolAddress,
                        amountOut: v3Quote.toString()
                    });
                    const v3Result = await executeV3Swap(normalizedParams, v3Pool, dex, {
                        fastMode: true,
                        executionMode: 'turbo'
                    });
                    if (v3Result.success) return v3Result;
                    lastRescueError = v3Result.error || `turbo_rescue_v3_${dex}_failed`;
                    stepOutcome.selectedKind = 'v3';
                    stepOutcome.success = false;
                    stepOutcome.error = lastRescueError;
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
                        traceId,
                        chainId,
                        strategyKind: 'v3',
                        dex,
                        failureCode: classifyFailure(lastRescueError),
                        error: lastRescueError
                    });
                }

                if (rescueOrder.includes('v2')) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_start', {
                        traceId,
                        chainId,
                        strategyKind: 'v2'
                    });
                    const v2Pool = await pickBestPool(candidatePools, 'v2', chainId);
                    if (v2Pool) {
                        const v2QuoteBudgetMs = Math.max(120, Math.min(650, turboFastDeadline - Date.now()));
                        if (v2QuoteBudgetMs > 0) {
                            const v2Quote = await withTimeout(
                                getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId),
                                v2QuoteBudgetMs
                            ).catch(() => 0n);
                            if (v2Quote > 0n) {
                                let anchorRejected = false;
                                if (sourceAnchor) {
                                    const anchorCheck = evaluateSourceAnchorQuote(v2Quote, sourceAnchor);
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v2',
                                        sourceTxHash: sourceAnchor.sourceTxHash || null,
                                        quotedOut: v2Quote.toString(),
                                        expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
                                        anchorRatioBps: anchorCheck.ratioBps,
                                        minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
                                        anchorAccepted: anchorCheck.accepted
                                    });
                                    if (!anchorCheck.accepted) {
                                        lastRescueError = `source_anchor_guard_reject:v2:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`;
                                        anchorRejected = true;
                                    }
                                }
                                if (anchorRejected) {
                                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v2',
                                        skipReason: 'source_anchor_guard_reject'
                                    });
                                } else {
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v2',
                                        selectedKind: 'v2',
                                        pool: v2Pool.poolAddress,
                                        amountOut: v2Quote.toString()
                                    });
                                    const v2Result = await executeV2Swap(normalizedParams, v2Quote);
                                    if (v2Result.success) return v2Result;
                                    lastRescueError = v2Result.error || 'turbo_rescue_v2_failed';
                                    stepOutcome.selectedKind = 'v2';
                                    stepOutcome.success = false;
                                    stepOutcome.error = lastRescueError;
                                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_failed', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'v2',
                                        failureCode: classifyFailure(lastRescueError),
                                        error: lastRescueError
                                    });
                                }
                            } else {
                                logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                                    traceId,
                                    chainId,
                                    strategyKind: 'v2',
                                    skipReason: 'v2_quote_unavailable',
                                    quoteBudgetMs: v2QuoteBudgetMs
                                });
                            }
                        } else {
                            logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                                traceId,
                                chainId,
                                strategyKind: 'v2',
                                skipReason: 'budget_exhausted',
                                quoteBudgetMs: v2QuoteBudgetMs
                            });
                        }
                    } else {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                            traceId,
                            chainId,
                            strategyKind: 'v2',
                            skipReason: 'no_pool_candidate'
                        });
                    }
                }

                if (rescueOrder.includes('aerodrome')) {
                    const aeroPool = await pickBestPool(candidatePools, 'aerodrome', chainId);
                    if (aeroPool) {
                        const aeroQuoteBudgetMs = Math.max(120, Math.min(650, turboFastDeadline - Date.now()));
                        if (aeroQuoteBudgetMs > 0) {
                            const aeroQuote = await withTimeout(
                                getAerodromeExpectedOutput(
                                    normalizedTokenIn,
                                    normalizedTokenOut,
                                    amountInWei,
                                    chainId,
                                    params.slippageBps,
                                    params.walletAddress
                                ),
                                aeroQuoteBudgetMs
                            ).catch(() => 0n);
                            if (aeroQuote > 0n) {
                                let anchorRejected = false;
                                if (sourceAnchor) {
                                    const anchorCheck = evaluateSourceAnchorQuote(aeroQuote, sourceAnchor);
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Source anchor quote check (turbo rescue)', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'aerodrome',
                                        sourceTxHash: sourceAnchor.sourceTxHash || null,
                                        quotedOut: aeroQuote.toString(),
                                        expectedOutFromSource: sourceAnchor.expectedOutFromSource.toString(),
                                        anchorRatioBps: anchorCheck.ratioBps,
                                        minAnchorRatioBps: sourceAnchor.minAnchorRatioBps,
                                        anchorAccepted: anchorCheck.accepted
                                    });
                                    if (!anchorCheck.accepted) {
                                        lastRescueError = `source_anchor_guard_reject:aerodrome:${anchorCheck.ratioBps}:${sourceAnchor.minAnchorRatioBps}`;
                                        anchorRejected = true;
                                    }
                                }
                                if (anchorRejected) {
                                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_skipped', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'aerodrome',
                                        skipReason: 'source_anchor_guard_reject'
                                    });
                                } else {
                                    logger.info(LogCode.SYS_INFO, '[DirectSwap] turbo_rescue_step_selected', {
                                        traceId,
                                        chainId,
                                        strategyKind: 'aerodrome',
                                        selectedKind: 'aerodrome',
                                        pool: aeroPool.poolAddress,
                                        amountOut: aeroQuote.toString()
                                    });
                                    const aeroResult = await executeAerodromeSwap(normalizedParams);
                                    if (aeroResult.success) return aeroResult;
                                    lastRescueError = aeroResult.error || 'turbo_rescue_aerodrome_failed';
                                    stepOutcome.selectedKind = 'aerodrome';
                                    stepOutcome.success = false;
                                    stepOutcome.error = lastRescueError;
                                }
                            } else {
                                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome quote unavailable', {
                                    traceId,
                                    chainId,
                                    strategyKind: 'aerodrome',
                                    pool: aeroPool.poolAddress,
                                    amountOut: aeroQuote.toString(),
                                    quoteBudgetMs: aeroQuoteBudgetMs
                                });
                            }
                        } else {
                            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome skipped: budget exhausted', {
                                traceId,
                                chainId,
                                strategyKind: 'aerodrome',
                                pool: aeroPool.poolAddress,
                                quoteBudgetMs: aeroQuoteBudgetMs
                            });
                        }
                    } else {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue Aerodrome skipped: no pool candidate', {
                            traceId,
                            chainId
                        });
                    }
                }

                return {
                    success: false,
                    error: `turbo_rescue_exhausted:${stepOutcome.error || lastRescueError}`,
                    provider: 'failed'
                };
            };

            let sourceHintCandidate = earlyHintedPool;
            if (!sourceHintCandidate && params.hint?.sourceTxHash) {
                const sourceHintBudgetMs = Math.max(200, Math.min(900, turboFastDeadline - Date.now()));
                if (sourceHintBudgetMs > 0) {
                    sourceHintCandidate = await withTimeout(
                        resolveHintedPoolFromSourceTx({
                            tokenIn: poolTokenIn,
                            tokenOut: poolTokenOut,
                            chainId,
                            hint: params.hint
                        }),
                        sourceHintBudgetMs
                    ).catch(() => null);
                }
            }

            const cachedSinglePoolHint = await getCachedSinglePoolWinnerHint(chainId, poolTokenIn, poolTokenOut);
            let turboCandidates = await singlePoolTurboResolver.resolveCandidates({
                chainId,
                tokenIn: poolTokenIn,
                tokenOut: poolTokenOut,
                amountInWei,
                hint: params.hint,
                sourceHint: sourceHintCandidate,
                cachedWinnerHint: cachedSinglePoolHint,
                deadlineMs: turboFastDeadline
            });

            logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool candidates resolved', {
                chainId,
                traceId,
                candidateCount: turboCandidates.length,
                sources: {
                    resolvedHint: Boolean(params.hint?.resolvedPoolHint),
                    sourceTxHint: Boolean(sourceHintCandidate),
                    cachedHint: Boolean(cachedSinglePoolHint)
                }
            });

            if (chainId === 8453 && params.executionMode === 'turbo') {
                const aeroTrusted = isLikelyAerodromeHintTrustworthy(params.hint);
                if (!aeroTrusted) {
                    const before = turboCandidates.length;
                    turboCandidates = turboCandidates.filter((candidate) => candidate.kind !== 'aerodrome');
                    if (before !== turboCandidates.length) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo candidate filter dropped untrusted Aerodrome hints', {
                            traceId,
                            chainId,
                            before,
                            after: turboCandidates.length,
                            sourceDex: params.hint?.sourceDexName || null
                        });
                    }
                }
            }

            if (isBuySideStableOrNativeIn(chainId, normalizedTokenIn) && turboCandidates.length > 0) {
                const candidateCountBeforeGate = turboCandidates.length;
                const gateBudgetMs = Math.max(120, Math.min(DIRECT_SWAP_HINT_POOL_TIMEOUT_MS, turboFastDeadline - Date.now()));
                let gatePools: PoolInfo[] = [];
                let gateDiscoveryFailed = false;
                if (gateBudgetMs <= 80) {
                    gateDiscoveryFailed = true;
                } else {
                    try {
                        gatePools = await withTimeout(
                            findTokenPools(poolTokenIn, poolTokenOut, chainId),
                            gateBudgetMs
                        );
                    } catch {
                        gateDiscoveryFailed = true;
                    }
                }

                if (gateDiscoveryFailed || gatePools.length === 0) {
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo candidate liquidity gate unavailable', {
                        traceId,
                        chainId,
                        gateBudgetMs,
                        gateDiscoveryFailed,
                        poolCount: gatePools.length
                    });
                    turboCandidates = [];
                } else {
                    const dropped: Array<Record<string, string | number | null>> = [];
                    turboCandidates = turboCandidates.filter((candidate) => {
                        const gate = evaluateResolvedHintFastPathLiquidityGateFromPools({
                            pools: gatePools,
                            tokenIn: poolTokenIn,
                            amountInWei,
                            resolvedHint: candidate,
                            multiplier: Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
                        });
                        if (!gate.allowed) {
                            dropped.push({
                                kind: candidate.kind,
                                dex: candidate.dex || null,
                                poolAddress: candidate.poolAddress || null,
                                reason: gate.reason,
                                blockType: gate.blockType
                            });
                        }
                        return gate.allowed;
                    });
                    if (dropped.length > 0) {
                        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo candidates dropped by liquidity gate', {
                            traceId,
                            chainId,
                            droppedCount: dropped.length,
                            remaining: turboCandidates.length,
                            dropped
                        });
                    }
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo candidate liquidity gate summary', {
                        traceId,
                        chainId,
                        candidateCountBeforeGate,
                        candidateCountAfterGate: turboCandidates.length,
                        droppedCount: dropped.length,
                        gatePoolCount: gatePools.length
                    });
                }
            }

            if (turboCandidates.length === 0) {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool candidates empty, entering rescue', {
                    traceId,
                    chainId
                });
                return finish(await runTurboRescue('no_valid_candidate_hint'));
            }

            const turboOrder = buildTurboRescueOrder(chainId);
            const turboAttemptPlan = buildTurboSinglePoolAttemptPlan(turboCandidates, chainId);
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool attempt plan', {
                chainId,
                traceId,
                turboOrder: turboOrder.join(' -> '),
                attempts: turboAttemptPlan.map((candidate, idx) => ({
                    idx: idx + 1,
                    kind: candidate.kind,
                    dex: candidate.dex || null,
                    poolAddress: candidate.poolAddress || null
                }))
            });

            let lastTurboError = 'Turbo single-pool attempt failed';
            for (let attempt = 0; attempt < turboAttemptPlan.length; attempt++) {
                const candidate = turboAttemptPlan[attempt];
                const turboHint: DirectSwapHint = {
                    ...(params.hint || {}),
                    canUseResolvedPoolFastPath: true,
                    routeHopCount: 1,
                    resolvedPoolHint: candidate
                };
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool attempt', {
                    chainId,
                    traceId,
                    attempt: attempt + 1,
                    turboOrder: turboOrder.join(' -> '),
                    resolvedHintKind: candidate.kind,
                    selectedKind: candidate.kind,
                    kind: candidate.kind,
                    dex: candidate.dex,
                    poolAddress: candidate.poolAddress
                });
                const directTry = await tryResolvedPoolHintFastPath(
                    normalizedParams,
                    turboHint,
                    { executionMode: 'turbo', trustedHint: true }
                );
                if (directTry?.success) {
                    selectedResolvedHintForCache = candidate;
                    return finish(directTry);
                }
                if (directTry?.error) {
                    lastTurboError = directTry.error;
                }
                if (shouldSkipResolvedHintRetry(directTry?.error)) {
                    break;
                }
            }

            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool attempts failed, entering rescue', {
                traceId,
                chainId,
                turboOrder: turboOrder.join(' -> '),
                failureCode: classifyFailure(lastTurboError),
                lastTurboError
            });
            return finish(await runTurboRescue(lastTurboError));
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
            const fastPathCap = amountInWei * 1_000_000n;
            const cappedRef = referenceQuote > fastPathCap ? 0n : referenceQuote;
            cachedReferenceQuote = cappedRef;
            if (referenceQuote > fastPathCap) {
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
                const deviationBps = Math.min(Math.max(REFERENCE_DEVIATION_BPS, 0), 5000);
                const minReasonable = cappedRef * BigInt(10000 - deviationBps) / 10000n;
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
                    ? (infinityPrecheckFailed ? 5000 : DIRECT_SWAP_HINT_POOL_TIMEOUT_MS)
                    : 5000;
                const poolBudgetMs = turboMode
                    ? Math.max(120, Math.min(basePoolBudgetMs, turboFastDeadline - Date.now()))
                    : basePoolBudgetMs;
                pools = await withTimeout(
                    findTokenPools(poolTokenIn, poolTokenOut, chainId),
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
                        ? (infinityPrecheckFailed ? 5000 : DIRECT_SWAP_HINT_POOL_TIMEOUT_MS)
                        : 5000
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
                    const aeroDepth = evaluateAerodromeBuySideDepth(pools, poolTokenIn, amountInWei);
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
            const fallbackMax = amountInWei * 1_000_000n;
            if (referenceQuote > fallbackMax) {
                logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Reference quote sanity cap (use-site): exceeds max reasonable', {
                    traceId,
                    referenceQuote: referenceQuote.toString().slice(0, 20),
                    maxReasonable: fallbackMax.toString().slice(0, 20)
                });
                referenceQuote = 0n;
                referenceCappedToZero = true;
            } else {
                try {
                    const [inMeta, outMeta] = await Promise.all([
                        getTokenMetadata(chainId, normalizedTokenIn),
                        getTokenMetadata(chainId, normalizedTokenOut)
                    ]);
                    const inDec = inMeta?.decimals ?? 18;
                    const outDec = outMeta?.decimals ?? 18;
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
        if (referenceQuote <= 0n && !canUseSourceHintFallback && !turboMode && !referenceCappedToZero && !skipReferenceQuote) {
            return finish({ success: false, error: 'No valid reference price (0x/Kyber/Gecko)', provider: 'failed' });
        }
        if (referenceQuote <= 0n && canUseSourceHintFallback) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Reference quote unavailable, continuing with source hint fallback', {
                chainId,
                txHash: params.hint?.sourceTxHash
            });
        }
        if (referenceQuote <= 0n && !preferredStrategy && !turboMode && !referenceCappedToZero && !skipReferenceQuote) {
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

        const deviationBps = Math.min(Math.max(REFERENCE_DEVIATION_BPS, 0), 5000);
        const noReferenceMode = referenceQuote <= 0n;
        const minReasonable = referenceQuote > 0n
            ? referenceQuote * BigInt(10000 - deviationBps) / 10000n
            : 0n;
        const mergedStrategies = mergeStrategies(defaultStrategies, preferredStrategy || cachedWinningStrategy);
        const preFilteredStrategies = noReferenceMode && preferredStrategy
            ? (pools.length > 0
                ? mergedStrategies
                : mergedStrategies.filter((s) => {
                    if (s.kind === preferredStrategy.kind || (forceV4 && s.kind === 'v4')) return true;
                    // Base fallback: Zora tokens are often traded via SDK path when V4 pool scan is incomplete.
                    if (chainId === 8453 && preferredStrategy.kind === 'v4' && s.kind === 'zora-sdk' && zoraRoutesEnabled) return true;
                    // Base fallback: some virtual launchpad tokens route via V3 bridge.
                    if (chainId === 8453 && preferredStrategy.kind === 'v4' && s.kind === 'virtual-bridge' && virtualLikely) return true;
                    return false;
                }))
            : mergedStrategies;
        const strategies = preFilteredStrategies;

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
            zoraRoutesEnabled
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
                    const aeroDepth = evaluateAerodromeBuySideDepth(pools, poolTokenIn, amountInWei);
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
