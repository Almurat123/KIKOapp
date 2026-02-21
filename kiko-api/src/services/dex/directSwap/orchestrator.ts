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
import { calculatePriceFromSqrtX96, findV4Pools, V4PoolInfo, V4PoolKey, matchV4PoolKeyById } from '../uniswapV4.js';
import { isV4SwapSupported } from '../uniswapV4Swap.js';
import { calculateV3TVL } from '../v3Math.js';
import { callRpc, callRpcRaw } from '../../rpcManager.js';
import { sendTransaction } from '../../privyWallet.js';
import { getZeroExPrice } from '../../zeroEx.js';
import { getKyberQuote } from '../../kyberAggregator.js';
import { getTokenDetails } from '../../geckoTerminal.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getTokenMetadata } from '../../rpcService.js';
import { get as getDbCache } from '../../../cache/dbCache.js';
import { get as cacheGet, set as cacheSet, del as cacheDel } from '../../../cache/cacheClient.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from '../types.js';
import { buildAerodromeSwapTransaction, getAerodromeQuote } from '../aerodrome.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { buildV4HookDataCandidates, isClankerHook, resolveV4HookProfile } from '../v4Hooks.js';
import { extractRevertReason } from '../../../utils/evm.js';
import { SelectedV4Pool } from '../v4ExecutionPlan.js';
import { zoraService } from '../../zoraService.js';
import {
    resolveHintedPoolFromSwapSupply as resolveHintedPoolFromSourceTx,
    resolveHintedV4PoolFromSwapSupply as resolveHintedV4PoolFromSourceTx
} from './supplyParser.js';
import type { DexFamily, StrategyKind, DexStrategy, HintedSourcePool, DirectSwapHint } from '../directSwapTypes.js';
import type {
    DirectSwapExecutionMode,
    DirectSwapResult,
    DirectSwapTraceState,
    LiquidityLayerStatus,
    ReferenceQuoteDiagnostics,
    TokenLiquidity
} from './types.js';
import {
    CHAIN_STRATEGIES,
    DIRECT_SWAP_SUPPORTED_CHAINS,
    DOPPLER_LENS_QUOTER_ADDRESSES,
    UNISWAP_V4_POOL_MANAGER_BY_CHAIN,
    V4_QUOTER_ADDRESSES
} from './constants.js';
import { deriveHintStrategy, mergeStrategies } from './hint.js';
import { pickBestPoolByLiveSnapshot } from './onchainPoolSnapshot.js';
import { summarizePools } from './poolDiscovery.js';
import {
    buildReferenceQuoteCacheKey,
    buildSharedExternalReferenceQuoteCacheKey,
    pickBestReferenceQuote
} from './referenceQuote.js';
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
    getSharedExternalReferenceQuote,
    setSharedExternalReferenceQuote,
    referenceQuoteCache,
    referenceQuoteRedisKey,
    sharedExternalReferenceQuoteInflight,
    v4GasCacheKey,
    v4QuoterCache,
    v4QuoterRedisKey,
    v4SpotCache,
    v4SpotRedisKey,
    withInflightSingleflight
} from './cache.js';
import { executeV2Swap as executeV2SwapExecutor } from './executors/v2.js';
import { executeV3Swap as executeV3SwapExecutor } from './executors/v3.js';
import { executeV4Swap as executeV4SwapExecutor } from './executors/v4.js';
import { executeInfinitySwap as executeInfinitySwapExecutor } from './executors/infinity.js';

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
const V4_SPOT_CACHE_TTL_MS = Number(process.env.V4_SPOT_CACHE_TTL_MS || '15000');
const V4_QUOTER_CACHE_TTL_MS = Number(process.env.V4_QUOTER_CACHE_TTL_MS || '10000');
const V4_QUOTER_TIMEOUT_MS = Number(process.env.V4_QUOTER_TIMEOUT_MS || '1200');
const REFERENCE_QUOTE_TTL_MS = Number(process.env.DIRECT_SWAP_REF_CACHE_TTL_MS || '10000');
const REFERENCE_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_REF_TIMEOUT_MS || '2000');
const REFERENCE_SHARED_EXTERNAL_TTL_MS = Number(process.env.DIRECT_SWAP_REF_SHARED_TTL_MS || String(REFERENCE_QUOTE_TTL_MS));
const REFERENCE_SHARED_EXTERNAL_NEGATIVE_TTL_MS = Number(process.env.DIRECT_SWAP_REF_SHARED_NEGATIVE_TTL_MS || '1500');
const ZORA_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_TIMEOUT_MS || '5000');
const ZORA_REFERENCE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_REFERENCE_TIMEOUT_MS || '500');
const DIRECT_SWAP_HINT_POOL_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_HINT_POOL_TIMEOUT_MS || '1400');
const DIRECT_SWAP_FASTPATH_BUDGET_MS = Number(process.env.DIRECT_SWAP_FASTPATH_BUDGET_MS || '3500');
const DIRECT_SWAP_TURBO_V4_GAS_LIMIT = process.env.DIRECT_SWAP_TURBO_V4_GAS_LIMIT || '950000';
const DIRECT_SWAP_TURBO_V3_GAS_LIMIT = process.env.DIRECT_SWAP_TURBO_V3_GAS_LIMIT || '420000';
const V4_FAST_PATH = (process.env.DIRECT_SWAP_V4_FAST_PATH || 'true') === 'true';
const NO_POOL_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_NO_POOL_CACHE_TTL_MS || '15000');
const ZORA_RETRY_COUNT = Number(process.env.DIRECT_SWAP_ZORA_RETRY_COUNT || '1');
const ZORA_ROUTABLE_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_ZORA_ROUTABLE_CACHE_TTL_MS || '60000');
const WINNING_ROUTE_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_WINNING_ROUTE_CACHE_TTL_MS || '600');
const DIRECT_SWAP_TURBO_BUDGET_WARN_MS = Number(process.env.DIRECT_SWAP_TURBO_BUDGET_WARN_MS || '2000');
const DIRECT_SWAP_GAS_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_GAS_CACHE_TTL_MS || '600000');
const V4_DYNAMIC_FEE_FLAG = 0x800000;
const TURBO_INFLIGHT_LIQUIDITY_TTL_MS = Number(process.env.DIRECT_SWAP_TURBO_INFLIGHT_LIQUIDITY_TTL_MS || '8000');

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

const infinityPairCache = new Map<string, { poolKeys: InfinityPoolKey[]; timestamp: number }>();
const zoraRoutableTokenCache = new Map<string, { value: boolean; timestamp: number }>();
const turboInflightUsdReservations = new Map<string, { pairKey: string; usdAmount: number; expiresAt: number }>();
const turboInflightUsdByPair = new Map<string, number>();

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

function summarizeRpcError(err: any): {
    reason: string | null;
    code?: string;
    shortMessage: string;
    dataPreview?: string;
} {
    const message = String(err?.message || err || '');
    const reasonFromMessage = extractRevertReason(message);
    const nestedReason = extractRevertReason(err?.error?.message || err?.shortMessage || '');
    const reason = reasonFromMessage || nestedReason || null;
    const code = err?.code || err?.error?.code;
    const errorData = err?.error?.data || err?.data || err?.error?.error?.data;
    const dataPreview = typeof errorData === 'string'
        ? errorData.slice(0, 120)
        : undefined;

    return {
        reason,
        code: code ? String(code) : undefined,
        shortMessage: message.slice(0, 220),
        dataPreview
    };
}

function isTransientRpcFailureForPreSim(errSummary: {
    reason: string | null;
    code?: string;
    shortMessage: string;
    dataPreview?: string;
}): boolean {
    const msg = String(errSummary.shortMessage || '').toLowerCase();
    const code = String(errSummary.code || '').toLowerCase();
    const reason = String(errSummary.reason || '').toLowerCase();
    const data = String(errSummary.dataPreview || '').toLowerCase();

    // If we have an explicit revert reason/data, treat as real revert instead of transport noise.
    if (reason || (data && data !== '0x')) return false;

    if (msg.includes('all rpc endpoints failed')) return true;
    if (msg.includes('timeout_')) return true;
    if (msg.includes('network')) return true;
    if (msg.includes('fetch failed')) return true;
    if (msg.includes('missing revert data')) return true;
    if (msg.includes('socket hang up')) return true;
    if (code === 'aborterror') return true;
    if (code === 'ecconnreset') return true;
    if (code === 'etimedout') return true;

    return false;
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

function isZoraTransientError(error: any): boolean {
    const msg = String(error?.message || error || '').toLowerCase();
    return msg.includes('http 500')
        || msg.includes('"success":"false"')
        || msg.includes('fetch failed')
        || msg.includes('timeout');
}

async function createZoraQuoteWithRetry(payload: any): Promise<any> {
    let lastErr: any;
    for (let attempt = 0; attempt <= ZORA_RETRY_COUNT; attempt++) {
        try {
            return await zoraService.createTradeCallWithReferrer(payload);
        } catch (err: any) {
            lastErr = err;
            if (!isZoraTransientError(err) || attempt >= ZORA_RETRY_COUNT) break;
        }
    }
    throw lastErr;
}

function classifyFailure(error: string): string {
    const lower = String(error || '').toLowerCase();
    if (!lower) return 'failed_unknown';
    if (lower.startsWith('failed_')) return lower.split(':')[0];
    if (lower.includes('http 500') || lower.includes('"success":"false"')) return 'failed_external_quote_down';
    if (lower.includes('no suitable pool found')) return 'failed_pool_unavailable_hard';
    if (lower.includes('no valid reference price')) return 'failed_external_quote_down';
    if (lower.includes('429') || lower.includes('too many requests')) return 'failed_rpc_rate_limited';
    if (lower.includes('insufficient funds')) return 'failed_insufficient_funds';
    if (lower.includes('amountin must be > 0')) return 'failed_invalid_amount_in';
    return `failed_${lower.slice(0, 48).replace(/[^a-z0-9]+/g, '_')}`;
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

function trimAmountToDecimals(amount: string, decimals: number): string {
    const normalized = String(amount || '0').trim();
    if (!normalized.includes('.')) return normalized;
    const [intPart, fracPart] = normalized.split('.');
    if (decimals <= 0) return intPart || '0';
    return `${intPart || '0'}.${(fracPart || '').slice(0, decimals)}`;
}

function isLikelyRawWeiAmount(amount: string, decimals: number): boolean {
    const normalized = String(amount || '').trim();
    if (!/^\d+$/.test(normalized)) return false;
    if (normalized === '0') return false;
    const stripped = normalized.replace(/^0+/, '') || '0';
    if (stripped === '0') return false;
    // Heuristic:
    // - keep normal integer "human units" (e.g. 1, 10, 1000, 1000000 for 6-decimals) unchanged
    // - treat very long integer strings as already-smallest-unit values (wei-like)
    const minDigitsForRaw = Math.max(13, Math.max(0, decimals) + 1);
    return stripped.length >= minDigitsForRaw;
}

async function parseAmountInWeiByToken(
    tokenIn: string,
    amountIn: string,
    chainId: number
): Promise<bigint> {
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    let decimals = 18;
    if (tokenIn.toLowerCase() !== ETH_ADDRESS) {
        try {
            const meta = await getTokenMetadata(chainId, tokenIn);
            decimals = Number.isFinite(meta?.decimals) ? meta.decimals : 18;
        } catch {
            decimals = 18;
        }
    }
    if (isLikelyRawWeiAmount(amountIn, decimals)) {
        const raw = BigInt(amountIn);
        logger.info(LogCode.SYS_INFO, '[DirectSwap] amountIn interpreted as raw wei amount', {
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            amountIn: String(amountIn).slice(0, 32),
            decimals
        });
        return raw;
    }
    const safe = trimAmountToDecimals(amountIn, decimals);
    return ethers.parseUnits(safe, decimals);
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

function resolvePoolInReserve(pool: PoolInfo, tokenIn: string): bigint {
    const t0 = (pool.token0 || '').toLowerCase();
    const t1 = (pool.token1 || '').toLowerCase();
    const inToken = tokenIn.toLowerCase();
    const reserve0 = BigInt(pool.reserve0 || '0');
    const reserve1 = BigInt(pool.reserve1 || '0');
    if (t0 === inToken) return reserve0;
    if (t1 === inToken) return reserve1;
    return reserve0 > reserve1 ? reserve0 : reserve1;
}

function evaluateBuyLiquidityProtection(
    pools: PoolInfo[],
    tokenIn: string,
    amountInWei: bigint,
    multiplier: number
): {
    eligible: boolean;
    requiredReserveInWei: bigint;
    checkedPools: number;
    matchedPools: number;
    byVersion: { v2: number; v3: number; v4: number; aerodrome: number };
    sample: Array<{ version: string; pool: string; reserveLike: string; matched: boolean }>;
} {
    const requiredReserveInWei = amountInWei * BigInt(Math.max(1, multiplier));
    const byVersion = { v2: 0, v3: 0, v4: 0, aerodrome: 0 };
    let checkedPools = 0;
    let matchedPools = 0;
    const sample: Array<{ version: string; pool: string; reserveLike: string; matched: boolean }> = [];

    for (const p of pools) {
        const version = (p.version || '').toLowerCase();
        if (version === 'v2' || version === 'aerodrome') {
            const reserveLike = resolvePoolInReserve(p, tokenIn);
            const matched = reserveLike >= requiredReserveInWei;
            byVersion[version] += 1;
            checkedPools += 1;
            if (matched) matchedPools += 1;
            if (sample.length < 8) {
                sample.push({
                    version,
                    pool: String(p.poolAddress || '').slice(0, 12),
                    reserveLike: reserveLike.toString().slice(0, 20),
                    matched
                });
            }
            continue;
        }
        if (version === 'v3' || version === 'v4') {
            const reserveLike = BigInt(p.liquidity || '0');
            const matched = reserveLike >= requiredReserveInWei;
            byVersion[version] += 1;
            checkedPools += 1;
            if (matched) matchedPools += 1;
            if (sample.length < 8) {
                sample.push({
                    version,
                    pool: String(p.poolAddress || '').slice(0, 12),
                    reserveLike: reserveLike.toString().slice(0, 20),
                    matched
                });
            }
        }
    }

    return {
        eligible: matchedPools > 0,
        requiredReserveInWei,
        checkedPools,
        matchedPools,
        byVersion,
        sample
    };
}

function buildTurboPairKey(chainId: number, tokenA: string, tokenB: string): string {
    const a = tokenA.toLowerCase();
    const b = tokenB.toLowerCase();
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${chainId}:${x}:${y}`;
}

function cleanupTurboInflightUsdReservations(): void {
    const now = Date.now();
    for (const [id, record] of turboInflightUsdReservations.entries()) {
        if (record.expiresAt > now) continue;
        turboInflightUsdReservations.delete(id);
        const next = Math.max(0, (turboInflightUsdByPair.get(record.pairKey) || 0) - record.usdAmount);
        if (next <= 0) turboInflightUsdByPair.delete(record.pairKey);
        else turboInflightUsdByPair.set(record.pairKey, next);
    }
}

function getTurboInflightUsd(pairKey: string): number {
    cleanupTurboInflightUsdReservations();
    return turboInflightUsdByPair.get(pairKey) || 0;
}

function reserveTurboInflightUsd(pairKey: string, usdAmount: number): string | null {
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) return null;
    cleanupTurboInflightUsdReservations();
    const reservationId = `${pairKey}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    turboInflightUsdReservations.set(reservationId, {
        pairKey,
        usdAmount,
        expiresAt: Date.now() + TURBO_INFLIGHT_LIQUIDITY_TTL_MS
    });
    turboInflightUsdByPair.set(pairKey, (turboInflightUsdByPair.get(pairKey) || 0) + usdAmount);
    return reservationId;
}

function releaseTurboInflightUsd(reservationId: string | null): void {
    if (!reservationId) return;
    const record = turboInflightUsdReservations.get(reservationId);
    if (!record) return;
    turboInflightUsdReservations.delete(reservationId);
    const next = Math.max(0, (turboInflightUsdByPair.get(record.pairKey) || 0) - record.usdAmount);
    if (next <= 0) turboInflightUsdByPair.delete(record.pairKey);
    else turboInflightUsdByPair.set(record.pairKey, next);
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
        sendTransaction,
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
        sendTransaction,
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
        sendTransaction,
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
        sendTransaction,
        getTxExecutionProfile
    }, options);
}

function normalizePairTokenForHint(token: string, chainId: number): string {
    const normalized = String(token || '').toLowerCase();
    if (!normalized) return normalized;
    const nativePseudo = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    if (normalized === nativePseudo) {
        return (WETH_ADDRESSES[chainId] || nativePseudo).toLowerCase();
    }
    return normalized;
}

function isSameHintPair(
    tokenA: string,
    tokenB: string,
    tokenX: string,
    tokenY: string,
    chainId: number
): boolean {
    const a = normalizePairTokenForHint(tokenA, chainId);
    const b = normalizePairTokenForHint(tokenB, chainId);
    const x = normalizePairTokenForHint(tokenX, chainId);
    const y = normalizePairTokenForHint(tokenY, chainId);
    if (!a || !b || !x || !y) return false;
    return (a === x && b === y) || (a === y && b === x);
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
            params.chainId
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
            params.chainId
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

function shouldSkipResolvedHintRetry(error: string | undefined): boolean {
    const lower = String(error || '').toLowerCase();
    if (!lower) return false;
    const transientRpcFailure =
        lower.includes('all rpc endpoints failed')
        || lower.includes('capacity_limited')
        || lower.includes('circuit_open')
        || lower.includes('timeout');
    return (
        lower.includes('hint_pool_pair_mismatch')
        || lower.includes('hint_pool_tokens_unavailable')
        || lower.includes('hint_fastpath_disallowed')
        || (lower.includes('pre-sim reverted') && !transientRpcFailure)
    );
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

        // If hooks/tickSpacing are missing (event-derived hint), try to resolve from V4 pool scan
        const isIncomplete = poolKey.hooks === '0x0000000000000000000000000000000000000000'
            && poolKey.tickSpacing <= 0;
        if (isIncomplete && resolved.poolAddress) {
            const resolvedKey = matchV4PoolKeyById(
                params.chainId,
                resolved.poolAddress,
                poolKey.currency0,
                poolKey.currency1
            );
            if (resolvedKey) {
                poolKey = {
                    currency0: resolvedKey.currency0,
                    currency1: resolvedKey.currency1,
                    hooks: resolvedKey.hooks,
                    fee: resolvedKey.fee,
                    tickSpacing: resolvedKey.tickSpacing
                };
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
    let turboUsdReservationId: string | null = null;
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
        releaseTurboInflightUsd(turboUsdReservationId);
        turboUsdReservationId = null;
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
        if (allowNoPoolCache && await isFreshNoPoolCache(chainId, poolTokenIn, poolTokenOut)) {
            return finish({ success: false, error: 'No suitable pool found (cached)', provider: 'failed' });
        }

        const amountInWei = await parseAmountInWeiByToken(normalizedTokenIn, amountIn, chainId);
        if (amountInWei <= 0n) {
            return finish({ success: false, error: 'amountIn must be > 0', provider: 'failed' });
        }
        const defaultStrategies = CHAIN_STRATEGIES[chainId] || CHAIN_STRATEGIES[1];
        const cachedWinningStrategy = preferredStrategy
            ? null
            : await getCachedWinningStrategy(chainId, poolTokenIn, poolTokenOut);
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
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint attempt', {
                chainId,
                kind: params.hint.resolvedPoolHint.kind,
                dex: params.hint.resolvedPoolHint.dex,
                poolAddress: params.hint.resolvedPoolHint.poolAddress
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
                const remainingBudgetMs = turboFastDeadline - Date.now();
                if (remainingBudgetMs <= 80) {
                    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue skipped: budget exhausted', {
                        traceId,
                        chainId,
                        reason,
                        elapsedMs: Date.now() - swapStart,
                        budgetMs: DIRECT_SWAP_FASTPATH_BUDGET_MS
                    });
                    return { success: false, error: `Turbo rescue budget exhausted: ${reason}`, provider: 'failed' };
                }

                const rescuePoolBudgetMs = Math.max(180, Math.min(DIRECT_SWAP_HINT_POOL_TIMEOUT_MS, remainingBudgetMs));
                let rescuePools: PoolInfo[] = [];
                try {
                    rescuePools = await withTimeout(
                        findTokenPools(poolTokenIn, poolTokenOut, chainId),
                        rescuePoolBudgetMs
                    );
                } catch {
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
                    timeoutMs: rescuePoolBudgetMs
                });

                if (rescuePools.length === 0) {
                    return { success: false, error: `Turbo rescue failed: no pools after ${reason}`, provider: 'failed' };
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
                        const version = String(pool.version || '').toLowerCase();
                        if (version === 'v2' || version === 'aerodrome') {
                            return resolvePoolInReserve(pool, poolTokenIn) >= guard.requiredReserveInWei;
                        }
                        if (version === 'v3' || version === 'v4') {
                            return BigInt(pool.liquidity || '0') >= guard.requiredReserveInWei;
                        }
                        return false;
                    });
                    if (candidatePools.length === 0) {
                        return { success: false, error: `Turbo rescue failed: no pools pass liquidity guard after ${reason}`, provider: 'failed' };
                    }
                }

                let lastRescueError = `turbo_rescue_start:${reason}`;
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue strategy order', {
                    traceId,
                    chainId,
                    order: 'v4 -> v3 -> aerodrome',
                    candidatePools: candidatePools.length
                });

                if (isV4SwapSupported(chainId)) {
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
                                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue selected', {
                                    traceId,
                                    chainId,
                                    strategy: 'v4',
                                    poolId: v4Best.pool.poolAddress,
                                    amountOut: v4Best.amountOut.toString()
                                });
                                const v4Result = await executeV4Swap(normalizedParams, v4Best.pool, {
                                    fastMode: true,
                                    executionMode: 'turbo'
                                });
                                if (v4Result.success) return v4Result;
                                lastRescueError = v4Result.error || 'turbo_rescue_v4_failed';
                            }
                        }
                    }
                }

                const v3DexOrder: Array<'uniswap' | 'pancake'> = chainId === 56
                    ? ['pancake', 'uniswap']
                    : ['uniswap', 'pancake'];
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
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue selected', {
                        traceId,
                        chainId,
                        strategy: `v3:${dex}`,
                        pool: v3Pool.poolAddress,
                        amountOut: v3Quote.toString()
                    });
                    const v3Result = await executeV3Swap(normalizedParams, v3Pool, dex, {
                        fastMode: true,
                        executionMode: 'turbo'
                    });
                    if (v3Result.success) return v3Result;
                    lastRescueError = v3Result.error || `turbo_rescue_v3_${dex}_failed`;
                }

                if (chainId === 8453) {
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
                                logger.info(LogCode.SYS_INFO, '[DirectSwap] Turbo rescue selected', {
                                    traceId,
                                    chainId,
                                    strategy: 'aerodrome',
                                    pool: aeroPool.poolAddress,
                                    amountOut: aeroQuote.toString()
                                });
                                const aeroResult = await executeAerodromeSwap(normalizedParams);
                                if (aeroResult.success) return aeroResult;
                                lastRescueError = aeroResult.error || 'turbo_rescue_aerodrome_failed';
                            }
                        }
                    }
                }

                return {
                    success: false,
                    error: `Turbo rescue exhausted: ${lastRescueError}`,
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
            const turboCandidates = await singlePoolTurboResolver.resolveCandidates({
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

            if (turboCandidates.length === 0) {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo single-pool candidates empty, entering rescue', {
                    traceId,
                    chainId
                });
                return finish(await runTurboRescue('no_valid_candidate_hint'));
            }

            let lastTurboError = 'Turbo single-pool attempt failed';
            for (let attempt = 0; attempt < 2; attempt++) {
                const candidate = turboCandidates[Math.min(attempt, turboCandidates.length - 1)];
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
                        return finish(await executeV3VirtualBridgeSwap(normalizedParams, virtualToken, bridgeQuote));
                    }
                }
            } else if (preferredStrategy.kind === 'zora-sdk' && chainId === 8453) {
                const zoraQuote = await getZoraSdkExpectedOutput(normalizedTokenIn, normalizedTokenOut, amountInWei, chainId, params.walletAddress);
                if (zoraQuote > 0n) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Bypass strategy selected', {
                        strategy: 'zora-sdk',
                        amountOut: zoraQuote.toString()
                    });
                    const zoraResult = await executeZoraSdkSwap(normalizedParams);
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
                if (v4Best.pool && v4Best.amountOut >= minReasonable) {
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
                    reason: !v4Best.pool ? 'pool_unavailable' : 'quote_below_threshold',
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
                const zoraQuote = await getZoraSdkExpectedOutput(normalizedTokenIn, normalizedTokenOut, amountInWei, chainId, params.walletAddress);
                if (zoraQuote > 0n && zoraQuote >= minReasonable) {
                    tExecutionStart = Date.now();
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy selected', {
                        strategy: 'zora-sdk',
                        amountOut: zoraQuote.toString(),
                        minReasonable: minReasonable.toString()
                    });
                    const zoraResult = await executeZoraSdkSwap(normalizedParams);
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
                    return finish(await executeV3VirtualBridgeSwap(normalizedParams, virtualToken, bridgeQuote));
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

async function executeZoraSdkSwap(
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
    if (params.chainId !== 8453) {
        return { success: false, error: 'Zora SDK route only supported on Base', provider: 'failed' };
    }

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const tokenInLower = params.tokenIn.toLowerCase();
    const tokenOutLower = params.tokenOut.toLowerCase();
    const isEthIn = tokenInLower === ETH_ADDRESS;
    const isEthOut = tokenOutLower === ETH_ADDRESS;
    const amountInWei = params.amountInWei;

    try {
        const quote = await createZoraQuoteWithRetry({
            sell: isEthIn ? { type: 'eth' } : { type: 'erc20', address: params.tokenIn as `0x${string}` },
            buy: isEthOut ? { type: 'eth' } : { type: 'erc20', address: params.tokenOut as `0x${string}` },
            amountIn: amountInWei,
            sender: params.walletAddress as `0x${string}`,
            recipient: params.walletAddress as `0x${string}`,
            slippage: Math.min(Math.max(params.slippageBps / 10000, 0.001), 0.99),
            feeContext: 'copyTrade'
        } as any);

        const target = (quote as any)?.call?.target;
        const data = (quote as any)?.call?.data;
        const value = (quote as any)?.call?.value;
        if (!target || !data) {
            return { success: false, error: 'Zora SDK quote missing call payload', provider: 'failed' };
        }

        const txHash = await sendTransaction(params.userId, params.accessToken, {
            to: target,
            data,
            value: value ? BigInt(value).toString() : '0',
            chainId: params.chainId,
            txPurpose: 'trade',
            executionProfile: getTxExecutionProfile(params.chainId)
        });

        return {
            success: true,
            txHash,
            provider: 'zora-sdk',
            poolInfo: {
                version: 'v4',
                fee: 0,
                liquidity: '0'
            }
        };
    } catch (error: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Zora SDK swap failed', {
            error: error?.message?.slice(0, 120)
        });
        const zoraError = isZoraTransientError(error)
            ? `HTTP 500: {"success":"false"}`
            : String(error?.message || error || 'zora_swap_failed');
        return { success: false, error: zoraError, provider: 'failed' };
    }
}

async function getV2ExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const router = V2_ROUTERS[chainId];
    if (!router) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    try {
        const callData = v2RouterInterface.encodeFunctionData('getAmountsOut', [amountInWei, [normalizedIn, normalizedOut]]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: router,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = v2RouterInterface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded[0] as bigint[];
        return amounts[amounts.length - 1] || 0n;
    } catch {
        return 0n;
    }
}

async function getV3BestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake'
): Promise<bigint> {
    const quoter = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    if (!quoter) return 0n;

    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;

    // 所有 fee tier 并行查询，不再串行等待
    const results = await Promise.all(
        feeTiers.map(async (fee) => {
            try {
                const quoteParams = {
                    tokenIn,
                    tokenOut,
                    amountIn: amountInWei,
                    fee,
                    sqrtPriceLimitX96: 0
                };
                const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
                const result = await callRpc<string>(chainId, 'eth_call', [{
                    to: quoter,
                    data: callData
                }, 'latest']);
                if (!result || result === '0x') return 0n;
                const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
                return decoded[0] as bigint;
            } catch {
                return 0n;
            }
        })
    );

    return results.reduce((best, cur) => (cur > best ? cur : best), 0n);
}

interface V3BridgeQuote {
    amountOut: bigint;
    feeInToBridge: number;
    feeBridgeToOut: number;
}

async function getV3BridgeQuoteOut(
    tokenIn: string,
    bridgeToken: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake'
): Promise<V3BridgeQuote | null> {
    const quoter = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    if (!quoter) return null;

    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    let best: V3BridgeQuote | null = null;

    for (const fee1 of feeTiers) {
        let hop1Out = 0n;
        try {
            const params1 = {
                tokenIn,
                tokenOut: bridgeToken,
                amountIn: amountInWei,
                fee: fee1,
                sqrtPriceLimitX96: 0
            };
            const data1 = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [params1]);
            const res1 = await callRpc<string>(chainId, 'eth_call', [{ to: quoter, data: data1 }, 'latest']);
            if (res1 && res1 !== '0x') {
                const decoded1 = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', res1);
                hop1Out = decoded1[0] as bigint;
            }
        } catch {
            hop1Out = 0n;
        }
        if (hop1Out <= 0n) continue;

        for (const fee2 of feeTiers) {
            try {
                const params2 = {
                    tokenIn: bridgeToken,
                    tokenOut,
                    amountIn: hop1Out,
                    fee: fee2,
                    sqrtPriceLimitX96: 0
                };
                const data2 = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [params2]);
                const res2 = await callRpc<string>(chainId, 'eth_call', [{ to: quoter, data: data2 }, 'latest']);
                if (!res2 || res2 === '0x') continue;
                const decoded2 = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', res2);
                const out = decoded2[0] as bigint;
                if (!best || out > best.amountOut) {
                    best = {
                        amountOut: out,
                        feeInToBridge: fee1,
                        feeBridgeToOut: fee2
                    };
                }
            } catch {
                continue;
            }
        }
    }

    return best;
}

const MAX_UINT128 = (1n << 128n) - 1n;

type InfinityPoolKind = 'cl' | 'bin';

interface InfinityPoolKey {
    currency0: string;
    currency1: string;
    hooks: string;
    poolManager: string;
    fee: number;
    parameters: string;
}

interface InfinityBestQuote {
    amountOut: bigint;
    poolKey: InfinityPoolKey;
    zeroForOne: boolean;
    kind: InfinityPoolKind;
    fee: number;
    tickSpacing?: number;
    binStep?: number;
}

function sortCurrencies(tokenIn: string, tokenOut: string): { currency0: string; currency1: string; zeroForOne: boolean } {
    const a = ethers.getAddress(tokenIn);
    const b = ethers.getAddress(tokenOut);
    const aNum = BigInt(a.toLowerCase());
    const bNum = BigInt(b.toLowerCase());
    if (aNum < bNum) {
        return { currency0: a, currency1: b, zeroForOne: a.toLowerCase() === tokenIn.toLowerCase() };
    }
    return { currency0: b, currency1: a, zeroForOne: b.toLowerCase() === tokenIn.toLowerCase() };
}

function encodeInfinityParameters(rawValue: number): string {
    const value = BigInt(rawValue) << 16n;
    return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

function buildInfinityPoolKey(
    tokenIn: string,
    tokenOut: string,
    poolManager: string,
    fee: number,
    parameters: string
): { poolKey: InfinityPoolKey; zeroForOne: boolean } {
    const { currency0, currency1, zeroForOne } = sortCurrencies(tokenIn, tokenOut);
    return {
        poolKey: {
            currency0,
            currency1,
            hooks: INFINITY_HOOKS_ZERO,
            poolManager,
            fee,
            parameters
        },
        zeroForOne
    };
}

function buildInfinityPairKey(chainId: number, tokenA: string, tokenB: string): string {
    const a = ethers.getAddress(tokenA).toLowerCase();
    const b = ethers.getAddress(tokenB).toLowerCase();
    const [t0, t1] = a < b ? [a, b] : [b, a];
    return `infi:pair:${chainId}:${t0}:${t1}`;
}

async function loadInfinityPoolKeys(
    chainId: number,
    tokenIn: string,
    tokenOut: string
): Promise<InfinityPoolKey[]> {
    const pairKey = buildInfinityPairKey(chainId, tokenIn, tokenOut);
    const cached = infinityPairCache.get(pairKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.poolKeys;
    }

    const poolIdsRaw = await getDbCache(pairKey);
    if (!poolIdsRaw) return [];
    let poolIds: string[] = [];
    try {
        poolIds = JSON.parse(poolIdsRaw);
    } catch {
        return [];
    }
    if (!poolIds.length) return [];

    const poolKeys: InfinityPoolKey[] = [];
    for (const poolId of poolIds) {
        const poolKeyRaw = await getDbCache(`infi:poolkey:${chainId}:${poolId}`);
        if (!poolKeyRaw) continue;
        try {
            const parsed = JSON.parse(poolKeyRaw) as InfinityPoolKey;
            if (parsed.currency0 && parsed.currency1) {
                poolKeys.push({
                    currency0: parsed.currency0.toLowerCase(),
                    currency1: parsed.currency1.toLowerCase(),
                    hooks: parsed.hooks.toLowerCase(),
                    poolManager: parsed.poolManager.toLowerCase(),
                    fee: parsed.fee,
                    parameters: parsed.parameters
                });
            }
        } catch {
            continue;
        }
    }

    if (poolKeys.length) {
        infinityPairCache.set(pairKey, { poolKeys, timestamp: Date.now() });
    }
    return poolKeys;
}

function parseInfinityParameterValue(parameters: string): number {
    try {
        const raw = BigInt(parameters);
        const value = Number((raw >> 16n) & 0xffffn);
        return value;
    } catch {
        return 0;
    }
}

async function quoteInfinityExactInputSingle(
    quoter: string,
    params: {
        poolKey: InfinityPoolKey;
        zeroForOne: boolean;
        amountIn: bigint;
    },
    chainId: number
): Promise<bigint> {
    if (params.amountIn <= 0n || params.amountIn > MAX_UINT128) return 0n;
    try {
        const callData = infinityQuoterInterface.encodeFunctionData('quoteExactInputSingle', [{
            poolKey: params.poolKey,
            zeroForOne: params.zeroForOne,
            exactAmount: params.amountIn,
            hookData: '0x'
        }]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: quoter,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = infinityQuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
        const amountOut = decoded[0] as bigint;
        return amountOut;
    } catch {
        return 0n;
    }
}

async function getInfinityBestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<InfinityBestQuote | null> {
    if (chainId !== 56) return null;
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return null;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    // Fast path: cached pool keys — 并行 quote
    const cachedPoolKeys = await loadInfinityPoolKeys(chainId, normalizedIn, normalizedOut);
    if (cachedPoolKeys.length) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Infinity cache hit', {
            chainId,
            tokenIn: normalizedIn.slice(0, 10),
            tokenOut: normalizedOut.slice(0, 10),
            poolKeyCount: cachedPoolKeys.length
        });
        const cachedResults = await Promise.all(
            cachedPoolKeys.map(async (poolKey) => {
                const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn.toLowerCase();
                const isCl = poolKey.poolManager.toLowerCase() === PANCAKE_INFINITY_CL_POOL_MANAGER.toLowerCase();
                const quoter = isCl ? PANCAKE_INFINITY_CL_QUOTER : PANCAKE_INFINITY_BIN_QUOTER;
                const amountOut = await quoteInfinityExactInputSingle(
                    quoter,
                    { poolKey, zeroForOne, amountIn: amountInWei },
                    chainId
                );
                if (amountOut <= 0n) return null;
                return {
                    amountOut,
                    poolKey,
                    zeroForOne,
                    kind: (isCl ? 'cl' : 'bin') as 'cl' | 'bin',
                    fee: poolKey.fee,
                    tickSpacing: isCl ? parseInfinityParameterValue(poolKey.parameters) : undefined,
                    binStep: isCl ? undefined : parseInfinityParameterValue(poolKey.parameters)
                } satisfies InfinityBestQuote;
            })
        );
        const bestCached = cachedResults.reduce<InfinityBestQuote | null>((best, cur) => {
            if (!cur) return best;
            return !best || cur.amountOut > best.amountOut ? cur : best;
        }, null);
        if (bestCached) return bestCached;
    }

    // Discovery path: CL fees + Bin fees×steps — 全部并行
    const clCandidates: Array<{ fee: number; tickSpacing: number; parameters: string }> = [];
    for (const fee of INFINITY_CL_FEE_TIERS) {
        const tickSpacing = INFINITY_CL_TICK_SPACING_BY_FEE[fee];
        if (tickSpacing) clCandidates.push({ fee, tickSpacing, parameters: encodeInfinityParameters(tickSpacing) });
    }

    const binCandidates: Array<{ fee: number; binStep: number; parameters: string }> = [];
    for (const fee of INFINITY_CL_FEE_TIERS) {
        for (const binStep of INFINITY_BIN_STEPS) {
            binCandidates.push({ fee, binStep, parameters: encodeInfinityParameters(binStep) });
        }
    }

    const [clResults, binResults] = await Promise.all([
        Promise.all(clCandidates.map(async ({ fee, tickSpacing, parameters }) => {
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn, normalizedOut, PANCAKE_INFINITY_CL_POOL_MANAGER, fee, parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_CL_QUOTER, { poolKey, zeroForOne, amountIn: amountInWei }, chainId
            );
            if (amountOut <= 0n) return null;
            return { amountOut, poolKey, zeroForOne, kind: 'cl' as const, fee, tickSpacing };
        })),
        Promise.all(binCandidates.map(async ({ fee, binStep, parameters }) => {
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn, normalizedOut, PANCAKE_INFINITY_BIN_POOL_MANAGER, fee, parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_BIN_QUOTER, { poolKey, zeroForOne, amountIn: amountInWei }, chainId
            );
            if (amountOut <= 0n) return null;
            return { amountOut, poolKey, zeroForOne, kind: 'bin' as const, fee, binStep };
        }))
    ]);

    const all: InfinityBestQuote[] = [
        ...clResults.filter((r): r is NonNullable<typeof r> => r !== null),
        ...binResults.filter((r): r is NonNullable<typeof r> => r !== null)
    ];
    if (all.length === 0) return null;
    return all.reduce((best, cur) => cur.amountOut > best.amountOut ? cur : best);
}

async function getV4BestSpotOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const cacheKey = `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountInWei.toString()}`;
    const cached = v4SpotCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_SPOT_CACHE_TTL_MS) {
        return cached.value;
    }
    const redisCached = await cacheGet(v4SpotRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < V4_SPOT_CACHE_TTL_MS) {
                const value = BigInt(parsed.value);
                v4SpotCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    try {
        const best = await getV4BestPoolQuote(tokenIn, tokenOut, amountInWei, chainId);
        v4SpotCache.set(cacheKey, { value: best.amountOut, timestamp: Date.now() });
        await cacheSet(
            v4SpotRedisKey(cacheKey),
            JSON.stringify({ value: best.amountOut.toString(), timestamp: Date.now() }),
            Math.max(1, Math.ceil(V4_SPOT_CACHE_TTL_MS / 1000))
        ).catch(() => { });
        return best.amountOut;
    } catch {
        return 0n;
    }
}

function getV4QuoterAddress(chainId: number): string | undefined {
    return V4_QUOTER_ADDRESSES[chainId];
}

function decodeV4QuoterRevert(data: string): bigint | null {
    if (!data || data === '0x') return null;
    const selector = ethers.id('QuoteSwap(uint256)').slice(0, 10);
    if (!data.startsWith(selector)) return null;
    try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], '0x' + data.slice(10));
        return BigInt(decoded[0].toString());
    } catch {
        return null;
    }
}

async function callDopplerLensQuote(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountInWei: bigint,
    chainId: number,
    hookData: string
): Promise<bigint> {
    const lens = DOPPLER_LENS_QUOTER_ADDRESSES[chainId];
    const poolManager = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[chainId];
    if (!lens || !poolManager) return 0n;

    const iface = new ethers.Interface([
        'function quoteDopplerLensData(address poolManager,(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,int256 amountSpecified,bytes hookData) external returns ((int128 amount0,int128 amount1) delta,uint160 sqrtPriceX96After)'
    ]);

    const data = iface.encodeFunctionData('quoteDopplerLensData', [
        poolManager,
        {
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks
        },
        zeroForOne,
        amountInWei,
        hookData
    ]);

    const response = await withTimeout(
        callRpcRaw<any>(chainId, 'eth_call', [{ to: lens, data }, 'latest'], { strategy: 'fast', importance: 'critical' }),
        V4_QUOTER_TIMEOUT_MS
    ).catch(() => null);
    if (!response?.result) return 0n;

    try {
        const decoded = iface.decodeFunctionResult('quoteDopplerLensData', response.result) as any;
        const delta = decoded?.[0];
        if (!delta) return 0n;
        const amount0 = BigInt(delta.amount0?.toString?.() ?? delta[0]?.toString?.() ?? '0');
        const amount1 = BigInt(delta.amount1?.toString?.() ?? delta[1]?.toString?.() ?? '0');
        const out = zeroForOne ? (amount1 < 0n ? -amount1 : 0n) : (amount0 < 0n ? -amount0 : 0n);
        return out > 0n ? out : 0n;
    } catch {
        return 0n;
    }
}

async function callV4QuoterExactOut(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountInWei: bigint,
    chainId: number,
    payee?: string,
    gasPriceWei?: bigint,
    hookDataCandidatesOverride?: string[]
): Promise<bigint> {
    const quoter = getV4QuoterAddress(chainId);
    if (!quoter) return 0n;
    const MAX_UINT128 = (1n << 128n) - 1n;
    if (amountInWei <= 0n || amountInWei > MAX_UINT128) return 0n;

    const hookProfile = resolveV4HookProfile(chainId, poolKey.hooks);
    const isClanker = hookProfile.family === 'clanker';
    if (isClanker && !payee) return 0n;

    const payeeKey = isClanker && payee ? payee.toLowerCase() : 'nopayee';
    const gasKey = isClanker && gasPriceWei ? gasPriceWei.toString() : 'nogas';
    const cacheKey = `${chainId}:${poolKey.currency0.toLowerCase()}:${poolKey.currency1.toLowerCase()}:${poolKey.fee}:${poolKey.tickSpacing}:${poolKey.hooks.toLowerCase()}:${zeroForOne ? '1' : '0'}:${amountInWei.toString()}:${payeeKey}:${gasKey}`;
    const cached = v4QuoterCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_QUOTER_CACHE_TTL_MS) {
        return cached.value;
    }
    const redisCached = await cacheGet(v4QuoterRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < V4_QUOTER_CACHE_TTL_MS) {
                const value = BigInt(parsed.value);
                v4QuoterCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    const iface = new ethers.Interface([
        'function quoteExactInputSingle((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) external returns (uint256 amountOut,uint256 gasEstimate)'
    ]);

    const hookDataCandidates = (hookDataCandidatesOverride && hookDataCandidatesOverride.length > 0)
        ? hookDataCandidatesOverride
        : buildV4HookDataCandidates({
            chainId,
            hookAddress: poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
    const gasPriceCandidates: Array<bigint | undefined> = gasPriceWei && gasPriceWei > 0n
        ? [gasPriceWei, undefined]
        : [undefined];

    for (const hookData of hookDataCandidates) {
        if (hookProfile.family === 'doppler') {
            const dopplerOut = await callDopplerLensQuote(poolKey, zeroForOne, amountInWei, chainId, hookData);
            if (dopplerOut > 0n) {
                v4QuoterCache.set(cacheKey, { value: dopplerOut, timestamp: Date.now() });
                await cacheSet(
                    v4QuoterRedisKey(cacheKey),
                    JSON.stringify({ value: dopplerOut.toString(), timestamp: Date.now() }),
                    Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                ).catch(() => { });
                return dopplerOut;
            }
        }

        const data = iface.encodeFunctionData('quoteExactInputSingle', [
            {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                fee: poolKey.fee,
                tickSpacing: poolKey.tickSpacing,
                hooks: poolKey.hooks
            },
            zeroForOne,
            amountInWei,
            hookData
        ]);

        for (const gasCandidate of gasPriceCandidates) {
            const callParams: Record<string, any> = { to: quoter, data };
            if (gasCandidate && gasCandidate > 0n) {
                callParams.gasPrice = ethers.toQuantity(gasCandidate);
            }
            try {
                const response = await withTimeout(
                    callRpcRaw<any>(chainId, 'eth_call', [callParams, 'latest'], { strategy: 'fast', importance: 'critical' }),
                    V4_QUOTER_TIMEOUT_MS
                );

                if (response?.result) {
                    const decoded = iface.decodeFunctionResult('quoteExactInputSingle', response.result);
                    const amountOut = BigInt(decoded[0].toString());
                    v4QuoterCache.set(cacheKey, { value: amountOut, timestamp: Date.now() });
                    await cacheSet(
                        v4QuoterRedisKey(cacheKey),
                        JSON.stringify({ value: amountOut.toString(), timestamp: Date.now() }),
                        Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                    ).catch(() => { });
                    return amountOut;
                }

                const errorData = (response as any)?.error?.data?.data
                    || (response as any)?.error?.data
                    || (response as any)?.error?.message?.data;
                if (typeof errorData === 'string' && errorData.startsWith('0x')) {
                    const amountOut = decodeV4QuoterRevert(errorData);
                    if (amountOut && amountOut > 0n) {
                        v4QuoterCache.set(cacheKey, { value: amountOut, timestamp: Date.now() });
                        await cacheSet(
                            v4QuoterRedisKey(cacheKey),
                            JSON.stringify({ value: amountOut.toString(), timestamp: Date.now() }),
                            Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                        ).catch(() => { });
                        return amountOut;
                    }
                }
            } catch {
                // try next candidate
            }
        }
    }

    return 0n;
}

async function getV4BestPoolQuote(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    payee?: string,
    hint?: DirectSwapHint,
    options?: {
        preloadedPools?: V4PoolInfo[];
    }
): Promise<{ pool: SelectedV4Pool | null; amountOut: bigint }> {
    const pools = options?.preloadedPools || await findV4Pools(tokenIn, tokenOut, chainId);
    const hintedPool = pools.length === 0
        ? await resolveHintedV4PoolFromSourceTx({ tokenIn, tokenOut, chainId, hint })
        : null;
    if (!pools.length && !hintedPool) return { pool: null, amountOut: 0n };

    const basePoolKey = (pools[0]?.poolKey || hintedPool?.poolKey);
    if (!basePoolKey) return { pool: null, amountOut: 0n };
    const [meta0, meta1] = await Promise.all([
        getTokenMetadata(chainId, basePoolKey.currency0),
        getTokenMetadata(chainId, basePoolKey.currency1)
    ]);
    const decimals0 = meta0.decimals || 18;
    const decimals1 = meta1.decimals || 18;

    let bestOut = 0n;
    let bestPool: SelectedV4Pool | null = null;
    let fallbackPool: SelectedV4Pool | null = hintedPool;
    let fallbackLiquidity = hintedPool ? BigInt(hintedPool.liquidity || '0') : 0n;
    for (const pool of pools) {
        const zeroForOne = pool.poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();
        const liquidity = BigInt(pool.liquidity);
        if (liquidity <= 0n) continue;

        if (liquidity > fallbackLiquidity) {
            fallbackLiquidity = liquidity;
            fallbackPool = {
                poolId: pool.poolId,
                poolAddress: pool.poolId,
                poolKey: pool.poolKey,
                token0: pool.poolKey.currency0,
                token1: pool.poolKey.currency1,
                liquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPriceX96,
                fee: pool.lpFee,
                price: 0,
                version: 'v4',
                dex: 'uniswap'
            };
        }

        const spotPrice = calculatePriceFromSqrtX96(
            BigInt(pool.sqrtPriceX96),
            decimals0,
            decimals1
        );

        const hookDataCandidates = buildV4HookDataCandidates({
            chainId,
            hookAddress: pool.poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
        const quoterOut = await callV4QuoterExactOut(
            pool.poolKey,
            zeroForOne,
            amountInWei,
            chainId,
            payee,
            undefined,
            hookDataCandidates
        );
        if (quoterOut <= 0n) continue;

        if (quoterOut > bestOut) {
            bestOut = quoterOut;
            bestPool = {
                poolId: pool.poolId,
                poolAddress: pool.poolId,
                poolKey: pool.poolKey,
                token0: pool.poolKey.currency0,
                token1: pool.poolKey.currency1,
                liquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPriceX96,
                fee: pool.lpFee,
                price: spotPrice,
                version: 'v4',
                dex: 'uniswap'
            };
        }
    }

    if (hintedPool) {
        const zeroForOne = hintedPool.poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();
        const hintedHookCandidates = buildV4HookDataCandidates({
            chainId,
            hookAddress: hintedPool.poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
        const quoted = await callV4QuoterExactOut(
            hintedPool.poolKey,
            zeroForOne,
            amountInWei,
            chainId,
            payee,
            undefined,
            hintedHookCandidates
        );
        if (quoted > bestOut) {
            bestOut = quoted;
            bestPool = hintedPool;
        }
    }

    if (!bestPool && fallbackPool) {
        return { pool: fallbackPool, amountOut: 0n };
    }

    return { pool: bestPool, amountOut: bestOut };
}

async function getAerodromeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string
): Promise<bigint> {
    try {
        const quote = await getAerodromeQuote({
            tokenIn,
            tokenOut,
            amountIn: amountInWei,
            recipient,
            slippageBps
        }, chainId);
        return quote?.amountOut ? BigInt(quote.amountOut) : 0n;
    } catch {
        return 0n;
    }
}

async function getZoraSdkExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    recipient: string
): Promise<bigint> {
    if (chainId !== 8453) return 0n;
    if (amountInWei <= 0n) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();
    const isEthIn = tokenInLower === ETH_ADDRESS;
    const isEthOut = tokenOutLower === ETH_ADDRESS;

    try {
        const quote = await withTimeout(createZoraQuoteWithRetry({
            sell: isEthIn ? { type: 'eth' } : { type: 'erc20', address: tokenIn as `0x${string}` },
            buy: isEthOut ? { type: 'eth' } : { type: 'erc20', address: tokenOut as `0x${string}` },
            amountIn: amountInWei,
            sender: recipient as `0x${string}`,
            recipient: recipient as `0x${string}`,
            slippage: 0.05
        } as any), ZORA_QUOTE_TIMEOUT_MS);

        const outRaw = (quote as any)?.quote?.amountOut ?? (quote as any)?.amountOut;
        if (outRaw === undefined || outRaw === null) return 0n;
        return BigInt(outRaw.toString());
    } catch {
        return 0n;
    }
}

async function isZoraCoinAddress(address: string): Promise<boolean> {
    const normalized = String(address || '').toLowerCase();
    if (!normalized.startsWith('0x')) return false;

    const cached = zoraRoutableTokenCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < ZORA_ROUTABLE_CACHE_TTL_MS) {
        return cached.value;
    }

    try {
        const coin = await zoraService.getCoinByAddress(normalized);
        const isZoraCoin = Boolean(coin?.address);
        zoraRoutableTokenCache.set(normalized, { value: isZoraCoin, timestamp: Date.now() });
        return isZoraCoin;
    } catch {
        // If cannot classify token, skip Zora route for safety/perf.
        zoraRoutableTokenCache.set(normalized, { value: false, timestamp: Date.now() });
        return false;
    }
}

async function shouldEnableZoraRoutes(tokenIn: string, tokenOut: string, chainId: number): Promise<boolean> {
    if (chainId !== 8453) return false;
    const zoraToken = ZORA_TOKEN_ADDRESSES[chainId]?.toLowerCase();
    if (!zoraToken) return false;

    const inLower = String(tokenIn || '').toLowerCase();
    const outLower = String(tokenOut || '').toLowerCase();
    if (inLower === zoraToken || outLower === zoraToken) return true;

    const [inIsZoraCoin, outIsZoraCoin] = await Promise.all([
        isZoraCoinAddress(inLower),
        isZoraCoinAddress(outLower)
    ]);
    return inIsZoraCoin || outIsZoraCoin;
}

async function getV4ViaZoraBridgeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    recipient?: string
): Promise<bigint> {
    const zoraToken = ZORA_TOKEN_ADDRESSES[chainId];
    if (!zoraToken || chainId !== 8453) return 0n;
    if (amountInWei <= 0n) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;
    if (normalizedIn.toLowerCase() === zoraToken.toLowerCase()) return 0n;
    if (normalizedOut.toLowerCase() === zoraToken.toLowerCase()) return 0n;

    const firstHop = await getV4BestPoolQuote(normalizedIn, zoraToken, amountInWei, chainId, recipient);
    if (!firstHop.pool || firstHop.amountOut <= 0n) return 0n;
    const secondHop = await getV4BestPoolQuote(zoraToken, normalizedOut, firstHop.amountOut, chainId, recipient);
    return secondHop.amountOut > 0n ? secondHop.amountOut : 0n;
}

async function getV3ViaVirtualBridgeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const virtualToken = VIRTUAL_TOKEN_ADDRESSES[chainId];
    if (!virtualToken || chainId !== 8453) return 0n;
    if (amountInWei <= 0n) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;
    if (normalizedIn.toLowerCase() === virtualToken.toLowerCase()) return 0n;
    if (normalizedOut.toLowerCase() === virtualToken.toLowerCase()) return 0n;

    const quote = await getV3BridgeQuoteOut(normalizedIn, virtualToken, normalizedOut, amountInWei, chainId, 'uniswap');
    return quote?.amountOut || 0n;
}

async function getReferenceExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string,
    options?: { enableZoraRoutes?: boolean; diagnostics?: ReferenceQuoteDiagnostics; traceId?: string }
): Promise<bigint> {
    const diagnostics = options?.diagnostics;
    const traceId = options?.traceId;
    const enableZoraRoutes = options?.enableZoraRoutes === true;
    const zoraRefTimeoutMs = Math.min(REFERENCE_QUOTE_TIMEOUT_MS, ZORA_REFERENCE_TIMEOUT_MS);
    if (process.env.DIRECT_SWAP_REF_MODE === 'onchain-only') {
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const weth = WETH_ADDRESSES[chainId];
        const poolTokenIn = tokenIn.toLowerCase() === ETH_ADDRESS && weth ? weth : tokenIn;
        const poolTokenOut = tokenOut.toLowerCase() === ETH_ADDRESS && weth ? weth : tokenOut;

        const sourceCandidates = await Promise.all([
            withTimeout(
                getV4BestPoolQuote(poolTokenIn, poolTokenOut, amountInWei, chainId, recipient),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(r => ({ source: 'v4', amountOut: r.amountOut }))
                .catch(() => ({ source: 'v4', amountOut: 0n })),
            withTimeout(
                getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, chainId === 56 ? 'pancake' : 'uniswap'),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(v => ({ source: chainId === 56 ? 'v3:pancake' : 'v3:uniswap', amountOut: v }))
                .catch(() => ({ source: chainId === 56 ? 'v3:pancake' : 'v3:uniswap', amountOut: 0n })),
            withTimeout(
                getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(v => ({ source: chainId === 56 ? 'v2:pancake' : 'v2:uniswap', amountOut: v }))
                .catch(() => ({ source: chainId === 56 ? 'v2:pancake' : 'v2:uniswap', amountOut: 0n })),
            chainId === 8453
                ? withTimeout(
                    getAerodromeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, slippageBps, recipient),
                    REFERENCE_QUOTE_TIMEOUT_MS
                )
                    .then(v => ({ source: 'aerodrome', amountOut: v }))
                    .catch(() => ({ source: 'aerodrome', amountOut: 0n }))
                : Promise.resolve({ source: 'aerodrome', amountOut: 0n }),
            chainId === 8453 && enableZoraRoutes
                ? withTimeout(
                    getZoraSdkExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, recipient),
                    zoraRefTimeoutMs
                )
                    .then(v => ({ source: 'zora-sdk', amountOut: v }))
                    .catch(() => ({ source: 'zora-sdk', amountOut: 0n }))
                : Promise.resolve({ source: 'zora-sdk', amountOut: 0n }),
            chainId === 8453 && enableZoraRoutes
                ? withTimeout(
                    getV4ViaZoraBridgeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, recipient),
                    zoraRefTimeoutMs
                )
                    .then(v => ({ source: 'v4-zora-bridge', amountOut: v }))
                    .catch(() => ({ source: 'v4-zora-bridge', amountOut: 0n }))
                : Promise.resolve({ source: 'v4-zora-bridge', amountOut: 0n }),
            chainId === 8453
                ? withTimeout(
                    getV3ViaVirtualBridgeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId),
                    REFERENCE_QUOTE_TIMEOUT_MS
                )
                    .then(v => ({ source: 'v3-virtual-bridge', amountOut: v }))
                    .catch(() => ({ source: 'v3-virtual-bridge', amountOut: 0n }))
                : Promise.resolve({ source: 'v3-virtual-bridge', amountOut: 0n })
        ]);

        const best = pickBestReferenceQuote(sourceCandidates) || { source: 'none', amountOut: 0n };

        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] On-chain reference quote', {
            traceId,
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12),
            bestSource: best.source,
            bestOut: best.amountOut.toString().slice(0, 15),
            bySource: sourceCandidates
                .map(s => `${s.source}:${s.amountOut.toString().slice(0, 12)}`)
                .join(',')
        });
        diagnostics && (diagnostics.source = best.source);
        diagnostics && (diagnostics.l2Status = best.amountOut > 0n ? 'ok' : 'missing');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return best.amountOut > 0n ? best.amountOut : 0n;
    }
    const cacheKey = buildReferenceQuoteCacheKey({
        chainId,
        tokenIn,
        tokenOut,
        amountInWei,
        recipient,
        enableZoraRoutes
    });
    const cached = referenceQuoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REFERENCE_QUOTE_TTL_MS) {
        diagnostics && (diagnostics.source = 'cache:memory');
        diagnostics && (diagnostics.l2Status = 'ok');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return cached.value;
    }
    const redisCached = await cacheGet(referenceQuoteRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < REFERENCE_QUOTE_TTL_MS) {
                const value = BigInt(parsed.value);
                referenceQuoteCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                diagnostics && (diagnostics.source = 'cache:redis');
                diagnostics && (diagnostics.l2Status = 'ok');
                diagnostics && (diagnostics.l3Status = 'skipped');
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    const refStart = Date.now();

    let ref0x = 0n;
    let refKyber = 0n;
    const sharedExternalCacheKey = buildSharedExternalReferenceQuoteCacheKey({
        chainId,
        tokenIn,
        tokenOut,
        amountInWei
    });
    const sharedExternalQuote = await getSharedExternalReferenceQuote(
        sharedExternalCacheKey,
        REFERENCE_SHARED_EXTERNAL_TTL_MS
    );

    if (sharedExternalQuote) {
        ref0x = sharedExternalQuote.ref0x;
        refKyber = sharedExternalQuote.refKyber;
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Shared reference quote cache hit', {
            traceId,
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12),
            amountIn: amountInWei.toString().slice(0, 16)
        });
    } else {
        const { value: resolvedSharedQuote, shared } = await withInflightSingleflight(
            sharedExternalReferenceQuoteInflight,
            sharedExternalCacheKey,
            async () => {
                let localRef0x = 0n;
                let localRefKyber = 0n;
                const [zeroExResult, kyberResult] = await Promise.allSettled([
                    withAbortableTimeout(
                        (signal) => get0xExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, signal),
                        REFERENCE_QUOTE_TIMEOUT_MS
                    ),
                    withAbortableTimeout(
                        async (signal) => {
                            const res = await getKyberQuote(
                                tokenIn,
                                tokenOut,
                                amountInWei.toString(),
                                chainId,
                                slippageBps,
                                recipient,
                                'copyTrade',
                                undefined,
                                signal
                            );
                            return res?.amountOut ? BigInt(res.amountOut) : 0n;
                        },
                        REFERENCE_QUOTE_TIMEOUT_MS
                    )
                ]);
                if (zeroExResult.status === 'fulfilled') {
                    localRef0x = zeroExResult.value;
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x reference quote failed', {
                        traceId,
                        error: String(zeroExResult.reason?.message || zeroExResult.reason || '').slice(0, 80)
                    });
                }
                if (kyberResult.status === 'fulfilled') {
                    localRefKyber = kyberResult.value;
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Kyber reference quote failed', {
                        traceId,
                        error: String(kyberResult.reason?.message || kyberResult.reason || '').slice(0, 80)
                    });
                }

                const best = localRef0x > localRefKyber ? localRef0x : localRefKyber;
                const ttlMs = best > 0n
                    ? REFERENCE_SHARED_EXTERNAL_TTL_MS
                    : REFERENCE_SHARED_EXTERNAL_NEGATIVE_TTL_MS;
                await setSharedExternalReferenceQuote(
                    sharedExternalCacheKey,
                    { ref0x: localRef0x, refKyber: localRefKyber, best },
                    Math.max(1, Math.ceil(ttlMs / 1000))
                );
                return { ref0x: localRef0x, refKyber: localRefKyber, best };
            }
        );

        ref0x = resolvedSharedQuote.ref0x;
        refKyber = resolvedSharedQuote.refKyber;
        if (shared) {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Shared reference quote inflight join', {
                traceId,
                chainId,
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                amountIn: amountInWei.toString().slice(0, 16)
            });
        }
    }

    const bestRef = ref0x > refKyber ? ref0x : refKyber;
    if (bestRef > 0n) {
        referenceQuoteCache.set(cacheKey, { value: bestRef, timestamp: Date.now() });
        await cacheSet(
            referenceQuoteRedisKey(cacheKey),
            JSON.stringify({ value: bestRef.toString(), timestamp: Date.now() }),
            Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
        ).catch(() => { });
        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote ready', {
            traceId,
            ref0x: ref0x.toString().slice(0, 15),
            refKyber: refKyber.toString().slice(0, 15),
            durationMs: Date.now() - refStart
        });
        diagnostics && (diagnostics.source = ref0x >= refKyber ? '0x' : 'kyber');
        diagnostics && (diagnostics.l2Status = 'ok');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return bestRef;
    }

    // Fallback: use V4 spot quote as reference for very new tokens
    if (isV4SwapSupported(chainId)) {
        const v4Spot = await getV4BestSpotOut(tokenIn, tokenOut, amountInWei, chainId);
        if (v4Spot > 0n) {
            referenceQuoteCache.set(cacheKey, { value: v4Spot, timestamp: Date.now() });
            await cacheSet(
                referenceQuoteRedisKey(cacheKey),
                JSON.stringify({ value: v4Spot.toString(), timestamp: Date.now() }),
                Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
            ).catch(() => { });
            logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote fallback (V4 spot)', {
                traceId,
                outWei: v4Spot.toString().slice(0, 15),
                durationMs: Date.now() - refStart
            });
            diagnostics && (diagnostics.source = 'v4-spot');
            diagnostics && (diagnostics.l2Status = 'ok');
            diagnostics && (diagnostics.l3Status = 'skipped');
            return v4Spot;
        }
    }

    try {
        const chainName = chainId === 8453 ? 'base'
            : chainId === 1 ? 'eth'
                : chainId === 56 ? 'bsc'
                    : chainId === 137 ? 'polygon'
                        : chainId === 42161 ? 'arbitrum'
                            : chainId === 10 ? 'optimism'
                                : '';
        if (chainName) {
            const [inDetails, outDetails] = await withTimeout(
                Promise.all([
                    getTokenDetails(chainName, tokenIn, 'high'),
                    getTokenDetails(chainName, tokenOut, 'high')
                ]),
                REFERENCE_QUOTE_TIMEOUT_MS
            );
            if (inDetails?.price && outDetails?.price && inDetails.price > 0 && outDetails.price > 0) {
                const [inMeta, outMeta] = await Promise.all([
                    getTokenMetadata(chainId, tokenIn),
                    getTokenMetadata(chainId, tokenOut)
                ]);
                const inAmountHuman = Number(amountInWei) / Math.pow(10, inMeta.decimals || 18);
                const outAmountHuman = inAmountHuman * (inDetails.price / outDetails.price);
                const outWei = BigInt(Math.max(0, Math.floor(outAmountHuman * Math.pow(10, outMeta.decimals || 18))));
                referenceQuoteCache.set(cacheKey, { value: outWei, timestamp: Date.now() });
                await cacheSet(
                    referenceQuoteRedisKey(cacheKey),
                    JSON.stringify({ value: outWei.toString(), timestamp: Date.now() }),
                    Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
                ).catch(() => { });
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote from Gecko', {
                    traceId,
                    outWei: outWei.toString().slice(0, 15),
                    durationMs: Date.now() - refStart
                });
                diagnostics && (diagnostics.source = 'gecko');
                diagnostics && (diagnostics.l2Status = 'missing');
                diagnostics && (diagnostics.l3Status = 'ok');
                return outWei;
            }
        }
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Gecko reference failed', {
            traceId,
            error: err?.message?.slice(0, 80)
        });
    }

    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] No reference quote available', {
        traceId,
        durationMs: Date.now() - refStart
    });
    diagnostics && (diagnostics.source = 'none');
    diagnostics && (diagnostics.l2Status = 'missing');
    diagnostics && (diagnostics.l3Status = 'missing');
    return 0n;
}

async function executeV3VirtualBridgeSwap(
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
    bridgeToken: string,
    quote: V3BridgeQuote
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, chainId, slippageBps } = params;
    const routerAddress = chainId === 8453 ? '0x2626664c2603336E57B271c5C0b26F421741e481' : '';
    if (!routerAddress) {
        return { success: false, error: 'V3 router not available for virtual bridge', provider: 'failed' };
    }

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) {
        return { success: false, error: 'WETH not configured', provider: 'failed' };
    }

    const amountInWei = params.amountInWei;
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    const normalizedIn = isNativeIn ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenOut;
    const minAmountOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;

    const path = ethers.solidityPacked(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [normalizedIn, quote.feeInToBridge, bridgeToken, quote.feeBridgeToOut, normalizedOut]
    );

    const ifaceNoDeadline = new ethers.Interface([
        'function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
    ]);
    const ifaceWithDeadline = new ethers.Interface([
        'function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
    ]);

    const deadline = Math.floor(Date.now() / 1000) + 300;
    const paramsNoDeadline = {
        path,
        recipient: walletAddress,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut
    };
    const paramsWithDeadline = {
        path,
        recipient: walletAddress,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut
    };

    let data = ifaceNoDeadline.encodeFunctionData('exactInput', [paramsNoDeadline]);
    try {
        await callRpc<string>(chainId, 'eth_estimateGas', [{
            from: walletAddress,
            to: routerAddress,
            data,
            value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
        }]);
    } catch {
        data = ifaceWithDeadline.encodeFunctionData('exactInput', [paramsWithDeadline]);
    }

    let gasLimit = '550000';
    try {
        const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
            from: walletAddress,
            to: routerAddress,
            data,
            value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
        }]);
        gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
        gasLimit = '550000';
    }
    const txHash = await sendTransaction(userId, accessToken, {
        to: routerAddress,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        txPurpose: 'trade',
        executionProfile: getTxExecutionProfile(chainId),
        gas: gasLimit
    });

    logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] Virtual bridge swap executed', {
        txHash,
        bridgeToken,
        feeInToVirtual: quote.feeInToBridge,
        feeVirtualToOut: quote.feeBridgeToOut
    });

    return {
        success: true,
        txHash,
        provider: 'uniswap-v3',
        poolInfo: {
            version: 'v3-virtual-bridge',
            fee: quote.feeInToBridge,
            liquidity: '0'
        }
    };
}

/**
 * 检查是否支持直接交易
 */
export function isDirectSwapSupported(chainId: number): boolean {
    return DIRECT_SWAP_SUPPORTED_CHAINS.includes(chainId as (typeof DIRECT_SWAP_SUPPORTED_CHAINS)[number]);
}

/**
 * 使用 0x Price API 获取预期输出金额
 * [Logic]: 用于计算 minAmountOut，提供滑点保护
 * [Ref]: 0x API docs - /swap/allowance-holder/price
 */
async function get0xExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    signal?: AbortSignal
): Promise<bigint> {
    try {
        const price = await getZeroExPrice(tokenIn, tokenOut, amountInWei.toString(), chainId, signal);
        if (price?.buyAmount) {
            logger.debug(LogCode.API_FETCH_SUCCESS, '[DirectSwap] 0x price fetched', {
                expectedOut: price.buyAmount.slice(0, 15)
            });
            return BigInt(price.buyAmount);
        }
    } catch (e: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x price fetch failed, no slippage protection', {
            error: e.message?.slice(0, 100)
        });
    }

    // [Risk]: 返回 0 表示无滑点保护 - 交易仍可继续但有风险
    return BigInt(0);
}
