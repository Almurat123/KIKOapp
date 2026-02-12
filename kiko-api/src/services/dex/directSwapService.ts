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
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { findTokenPools, getV2PoolInfo, getV3PoolInfo, PoolInfo } from './poolInfo.js';
import { calculatePriceFromSqrtX96, findV4Pools, getV4PoolInfo, matchV4PoolKeyById, V4PoolInfo, V4PoolKey } from './uniswapV4.js';
import { buildV4SwapTransaction, isV4SwapSupported } from './uniswapV4Swap.js';
import { calculateV3TVL } from './v3Math.js';
import { callRpc, callRpcRaw } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { getZeroExPrice } from '../zeroEx.js';
import { getKyberQuote } from '../kyberAggregator.js';
import { getTokenDetails } from '../geckoTerminal.js';
import { getTokenMetadata } from '../rpcService.js';
import { get as getDbCache } from '../../cache/dbCache.js';
import { get as cacheGet, set as cacheSet, del as cacheDel } from '../../cache/redis.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from './types.js';
import { buildAerodromeSwapTransaction, getAerodromeQuote } from './aerodrome.js';
import { getChainConfig } from '../../config/chainConfig.js';
import { buildV4HookDataCandidates, isClankerHook, resolveV4HookProfile } from './v4Hooks.js';
import { extractRevertReason } from '../../utils/evm.js';
import { buildV4ExecutionPlan, SelectedV4Pool } from './v4ExecutionPlan.js';
import { zoraService } from '../zoraService.js';

// 常用代币地址
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006', // Base
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',    // Ethereum
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // BSC (WBNB)
};

const USDC_ADDRESSES: Record<number, string> = {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
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
const ZORA_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_TIMEOUT_MS || '5000');
const ZORA_REFERENCE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_REFERENCE_TIMEOUT_MS || '500');
const DIRECT_SWAP_HINT_POOL_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_HINT_POOL_TIMEOUT_MS || '900');
const DIRECT_SWAP_FASTPATH_BUDGET_MS = Number(process.env.DIRECT_SWAP_FASTPATH_BUDGET_MS || '2000');
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

const v4SpotCache = new Map<string, { value: bigint; timestamp: number }>();
const v4QuoterCache = new Map<string, { value: bigint; timestamp: number }>();
const referenceQuoteCache = new Map<string, { value: bigint; timestamp: number }>();
const infinityPairCache = new Map<string, { poolKeys: InfinityPoolKey[]; timestamp: number }>();
const noPoolNegativeCache = new Map<string, { reason: string; timestamp: number }>();
function v4SpotRedisKey(cacheKey: string): string { return `directswap:v4spot:${cacheKey}`; }
function v4QuoterRedisKey(cacheKey: string): string { return `directswap:v4quoter:${cacheKey}`; }
function referenceQuoteRedisKey(cacheKey: string): string { return `directswap:refquote:${cacheKey}`; }

type DexFamily = 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
type StrategyKind = 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity' | 'zora-sdk' | 'virtual-bridge';

const V4_QUOTER_ADDRESSES: Record<number, string> = {
    8453: '0x0d5e0f971ed27fbff6c2837bf31316121532048d'
};

const V4_SWAP_EVENT = ethers.id('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');
const V4_INIT_EVENT = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const V3_SWAP_EVENT = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
const V2_SWAP_EVENT = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const v4InitEventInterface = new ethers.Interface([
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
]);
const hintedV4PoolCache = new Map<string, SelectedV4Pool | null>();
const hintedPoolCache = new Map<string, HintedSourcePool | null>();
const zoraRoutableTokenCache = new Map<string, { value: boolean; timestamp: number }>();
const winningRouteCache = new Map<string, { strategy: DexStrategy; timestamp: number }>();
const v4GasLimitCache = new Map<string, { gasLimit: string; timestamp: number }>();

interface DexStrategy {
    kind: StrategyKind;
    dex?: DexFamily;
}

type HintedSourcePool =
    | { kind: 'v4'; pool: SelectedV4Pool; dex: 'uniswap' | 'pancake' }
    | { kind: 'v3'; pool: PoolInfo; dex: 'uniswap' | 'pancake' }
    | { kind: 'v2'; pool: PoolInfo; dex: DexFamily };

interface DirectSwapHint {
    sourceDexName?: string;
    sourceRouter?: string;
    sourceTxHash?: string;
    resolvedPoolHint?: {
        kind: 'v4' | 'v3' | 'v2';
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

type DirectSwapExecutionMode = 'balanced' | 'turbo';

function deriveHintStrategy(chainId: number, hint?: DirectSwapHint): DexStrategy | null {
    if (!hint) return null;
    if (hint.preferredStrategy) {
        return {
            kind: hint.preferredStrategy,
            dex: hint.preferredDex
        };
    }

    const dexName = String(hint.sourceDexName || '').toLowerCase().trim();
    const routerRaw = String(hint.sourceRouter || '').trim();
    const routerMatch = routerRaw.match(/0x[a-fA-F0-9]{40}/);
    const router = (routerMatch ? routerMatch[0] : routerRaw).toLowerCase();
    if (!dexName && !router) return null;

    if (dexName.includes('aerodrome') || dexName.includes('velodrome')) {
        return { kind: 'aerodrome', dex: 'aerodrome' };
    }
    if (dexName.includes('infinity')) {
        return { kind: 'infinity', dex: 'pancake-infinity' };
    }
    if (dexName.includes('virtual')) {
        return { kind: 'virtual-bridge', dex: 'uniswap' };
    }
    if (dexName.includes('zora')) {
        return { kind: 'zora-sdk', dex: 'uniswap' };
    }
    if (dexName.includes('v4') || dexName.includes('universal router')) {
        return { kind: 'v4', dex: chainId === 56 ? 'pancake' : 'uniswap' };
    }
    if (dexName.includes('v3')) {
        return { kind: 'v3', dex: dexName.includes('pancake') || chainId === 56 ? 'pancake' : 'uniswap' };
    }
    if (dexName.includes('v2')) {
        return { kind: 'v2', dex: dexName.includes('pancake') || chainId === 56 ? 'pancake' : 'uniswap' };
    }

    // Router fallback mapping for commonly observed addresses.
    if (router === '0x6ff5693b99212da76ad316178a184ab56d299b43' || router === '0x498581ff718922c3f8e6a244956af099b2652b2b') {
        return { kind: 'v4', dex: 'uniswap' };
    }
    if (router === '0x2626664c2603336e57b271c5c0b26f421741e481') {
        return { kind: 'v3', dex: 'uniswap' };
    }
    if (router === '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43' || router === '0x420dd381b31aef6683db6b902084cb0ffece40da') {
        return { kind: 'aerodrome', dex: 'aerodrome' };
    }
    // BaseSwap/Uniswap V2-like routers on Base
    if (router === '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24') {
        return { kind: 'v2', dex: 'uniswap' };
    }
    // Base aggregators: bias to V3 for faster fallback route.
    if (
        router === '0x0000000000001ff3684f28c67538d4d072c22734' // 0x
        || router === '0x6131b5fae19ea4f9d964eac0408e4408b66337b5' // Kyber
        || router === '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae' // LiFi
        || router === '0x1111111254eeb25477b68fb85ed929f73a960582' // 1inch
    ) {
        return { kind: 'v3', dex: chainId === 56 ? 'pancake' : 'uniswap' };
    }
    if (router === PANCAKE_V3_ROUTER.toLowerCase()) {
        return { kind: 'v3', dex: 'pancake' };
    }
    if (router === PANCAKE_INFINITY_ROUTER.toLowerCase()) {
        return { kind: 'infinity', dex: 'pancake-infinity' };
    }
    if (router === '0x10ed43c718714eb63d5aa57b78b54704e256024e') {
        return { kind: 'v2', dex: 'pancake' };
    }
    if (router === '0x13f4ea83d0bd40e75c8222255bc855a974568dd4' || router === '0x1b81d678ffb9c0263b24a97847620c99d213eb14') {
        return { kind: 'v3', dex: 'pancake' };
    }

    return null;
}

function mergeStrategies(defaultStrategies: DexStrategy[], preferred: DexStrategy | null): DexStrategy[] {
    if (!preferred) return [...defaultStrategies];
    const seen = new Set<string>();
    const merged = [preferred, ...defaultStrategies];
    const deduped: DexStrategy[] = [];
    for (const strategy of merged) {
        const key = `${strategy.kind}:${strategy.dex || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(strategy);
    }
    return deduped;
}

function winningRouteCacheKey(chainId: number, tokenIn: string, tokenOut: string): string {
    return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

function winningRouteRedisKey(cacheKey: string): string {
    return `directswap:winning_route:${cacheKey}`;
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

function v4GasCacheKey(chainId: number, poolId: string, tokenIn: string, tokenOut: string): string {
    return `${chainId}:${poolId.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

function getCachedV4GasLimit(key: string): string | null {
    const hit = v4GasLimitCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.timestamp > DIRECT_SWAP_GAS_CACHE_TTL_MS) {
        v4GasLimitCache.delete(key);
        return null;
    }
    return hit.gasLimit;
}

function setCachedV4GasLimit(key: string, gasLimit: string): void {
    v4GasLimitCache.set(key, { gasLimit, timestamp: Date.now() });
}

async function getCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string): Promise<DexStrategy | null> {
    const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
    const local = winningRouteCache.get(cacheKey);
    if (local && (Date.now() - local.timestamp) < WINNING_ROUTE_CACHE_TTL_MS * 1000) {
        return local.strategy;
    }
    try {
        const raw = await cacheGet(winningRouteRedisKey(cacheKey));
        if (raw) {
            const fromRedis = JSON.parse(raw) as { kind?: StrategyKind; dex?: DexFamily };
            if (!fromRedis?.kind) return null;
            const strategy: DexStrategy = { kind: fromRedis.kind, dex: fromRedis.dex };
            winningRouteCache.set(cacheKey, { strategy, timestamp: Date.now() });
            return strategy;
        }
    } catch {
        // ignore cache errors
    }
    return null;
}

async function setCachedWinningStrategy(chainId: number, tokenIn: string, tokenOut: string, strategy: DexStrategy): Promise<void> {
    const cacheKey = winningRouteCacheKey(chainId, tokenIn, tokenOut);
    winningRouteCache.set(cacheKey, { strategy, timestamp: Date.now() });
    try {
        await cacheSet(
            winningRouteRedisKey(cacheKey),
            JSON.stringify({ kind: strategy.kind, dex: strategy.dex }),
            Math.max(30, Math.floor(WINNING_ROUTE_CACHE_TTL_MS))
        );
    } catch {
        // ignore cache errors
    }
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

function getNoPoolCacheKey(chainId: number, tokenIn: string, tokenOut: string): string {
    return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

function noPoolRedisKey(chainId: number, tokenIn: string, tokenOut: string): string {
    return `directswap:nopool:${getNoPoolCacheKey(chainId, tokenIn, tokenOut)}`;
}

async function isFreshNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): Promise<boolean> {
    const key = getNoPoolCacheKey(chainId, tokenIn, tokenOut);
    const hit = noPoolNegativeCache.get(key);
    if (!hit) return false;
    if (Date.now() - hit.timestamp > NO_POOL_CACHE_TTL_MS) {
        noPoolNegativeCache.delete(key);
        return false;
    }
    const remote = await cacheGet(noPoolRedisKey(chainId, tokenIn, tokenOut)).catch(() => null);
    if (remote) return true;
    return true;
}

function setNoPoolCache(chainId: number, tokenIn: string, tokenOut: string, reason: string): void {
    const key = getNoPoolCacheKey(chainId, tokenIn, tokenOut);
    noPoolNegativeCache.set(key, { reason, timestamp: Date.now() });
    const ttlSeconds = Math.max(1, Math.ceil(NO_POOL_CACHE_TTL_MS / 1000));
    cacheSet(noPoolRedisKey(chainId, tokenIn, tokenOut), reason || '1', ttlSeconds).catch(() => { });
}

function clearNoPoolCache(chainId: number, tokenIn: string, tokenOut: string): void {
    noPoolNegativeCache.delete(getNoPoolCacheKey(chainId, tokenIn, tokenOut));
    cacheDel(noPoolRedisKey(chainId, tokenIn, tokenOut)).catch(() => { });
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

const CHAIN_STRATEGIES: Record<number, DexStrategy[]> = {
    8453: [
        { kind: 'v4', dex: 'uniswap' },
        { kind: 'virtual-bridge', dex: 'uniswap' },
        { kind: 'zora-sdk', dex: 'uniswap' },
        { kind: 'v3', dex: 'uniswap' },
        { kind: 'aerodrome', dex: 'aerodrome' },
        { kind: 'v2', dex: 'uniswap' }
    ],
    56: [
        { kind: 'v3', dex: 'pancake' },
        { kind: 'infinity', dex: 'pancake-infinity' },
        { kind: 'v2', dex: 'pancake' }
    ],
    1: [
        { kind: 'v3', dex: 'uniswap' },
        { kind: 'v2', dex: 'uniswap' },
        { kind: 'v4', dex: 'uniswap' }
    ]
};

function getTxExecutionProfile(chainId: number): 'default' | 'base-sniper' | 'bsc-sniper' {
    if (chainId === 8453) return 'base-sniper';
    if (chainId === 56) return 'bsc-sniper';
    return 'default';
}

function pickBestPool(pools: PoolInfo[], version: PoolInfo['version'], dex?: DexFamily): PoolInfo | null {
    const candidates = pools.filter(p => p.version === version && (!dex || p.dex === dex));
    if (!candidates.length) return null;
    if (version === 'v2') {
        return candidates.sort((a, b) => {
            const aReserve = BigInt(a.reserve0 || '0') + BigInt(a.reserve1 || '0');
            const bReserve = BigInt(b.reserve0 || '0') + BigInt(b.reserve1 || '0');
            return bReserve > aReserve ? 1 : -1;
        })[0];
    }
    return candidates.sort((a, b) => {
        const aLiq = BigInt(a.liquidity || '0');
        const bLiq = BigInt(b.liquidity || '0');
        return bLiq > aLiq ? 1 : -1;
    })[0];
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
    const safe = trimAmountToDecimals(amountIn, decimals);
    return ethers.parseUnits(safe, decimals);
}

// ETH 价格 (临时硬编码，生产环境应从预言机获取)
const ETH_PRICE_USD = 2400;

/**
 * 直接交易结果
 */
export interface DirectSwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    error?: string;
    provider: 'uniswap-v2' | 'pancake-v2' | 'uniswap-v3' | 'pancake-v3' | 'uniswap-v4' | 'pancake-infinity' | 'aerodrome' | 'zora-sdk' | 'failed';
    poolInfo?: {
        version: string;
        fee: number;
        liquidity: string;
    };
}

/**
 * 代币流动性信息
 */
export interface TokenLiquidity {
    totalTvlUsd: number;
    pools: {
        version: string;
        fee: number;
        tvlUsd: number;
        address: string;
    }[];
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

                // WETH 价格
                const price0USD = isToken0 ? 0 : ETH_PRICE_USD;
                const price1USD = isToken0 ? ETH_PRICE_USD : 0;

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

/**
 * 查找最佳池子
 * [Logic]: 优先选择流动性最高的池子
 */
async function findBestPool(
    tokenIn: string,
    tokenOut: string,
    chainId: number
): Promise<PoolInfo | null> {
    // [Logic]: ETH 地址转换为 WETH，因为池子只认识 WETH
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenOut;

    if (!normalizedIn || !normalizedOut) {
        return null;
    }

    const pools = await findTokenPools(normalizedIn, normalizedOut, chainId);

    if (pools.length === 0) {
        return null;
    }

    // 按流动性排序，优先选择 V4
    const sorted = pools.sort((a, b) => {
        // V4 优先
        if (a.version === 'v4' && b.version !== 'v4') return -1;
        if (a.version !== 'v4' && b.version === 'v4') return 1;

        // 按流动性排序
        const liqA = BigInt(a.liquidity || '0');
        const liqB = BigInt(b.liquidity || '0');
        return liqB > liqA ? 1 : -1;
    });

    return sorted[0];
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
    hint?: DirectSwapHint
): Promise<DirectSwapResult | null> {
    const resolved = hint?.resolvedPoolHint;
    if (!resolved) return null;

    if (resolved.kind === 'v4' && resolved.v4PoolKey) {
        const selectedPool: SelectedV4Pool = {
            poolId: resolved.poolAddress || '',
            poolAddress: resolved.poolAddress || '',
            poolKey: {
                currency0: resolved.v4PoolKey.currency0,
                currency1: resolved.v4PoolKey.currency1,
                hooks: resolved.v4PoolKey.hooks,
                fee: resolved.v4PoolKey.fee,
                tickSpacing: resolved.v4PoolKey.tickSpacing
            },
            sqrtPriceX96: '0',
            fee: resolved.v4PoolKey.fee,
            liquidity: '0'
        };
        return executeV4Swap(params, selectedPool, { allowZeroQuoteMinOut: true, fastMode: true });
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
            return executeV3Swap(params, pool, dex, { fastMode: true });
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
    executionMode?: 'safe' | 'balanced' | 'turbo';
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

    logger.info(LogCode.EXE_TX_BROADCAST, '[DirectSwap] Starting direct swap', {
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
    const finish = async (result: DirectSwapResult): Promise<DirectSwapResult> => {
        const durationMs = Date.now() - swapStart;
        if (result.success) {
            clearNoPoolCache(chainId, poolCacheTokenIn, poolCacheTokenOut);
            const successfulStrategy = providerToStrategy(result.provider, chainId);
            if (successfulStrategy) {
                await setCachedWinningStrategy(chainId, poolCacheTokenIn, poolCacheTokenOut, successfulStrategy);
            }
        } else if (result.error) {
            const reasonCode = classifyFailure(result.error);
            result.error = `${reasonCode}: ${result.error}`;
            if (reasonCode.includes('pool_unavailable_hard')) {
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
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Finished', {
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

        const allowNoPoolCache = !params.hint?.sourceTxHash;
        if (allowNoPoolCache && await isFreshNoPoolCache(chainId, poolTokenIn, poolTokenOut)) {
            return finish({ success: false, error: 'No suitable pool found (cached)', provider: 'failed' });
        }

        const amountInWei = await parseAmountInWeiByToken(normalizedTokenIn, amountIn, chainId);
        if (amountInWei <= 0n) {
            return finish({ success: false, error: 'amountIn must be > 0', provider: 'failed' });
        }
        const defaultStrategies = CHAIN_STRATEGIES[chainId] || CHAIN_STRATEGIES[1];
        const preferredStrategy = deriveHintStrategy(chainId, params.hint);
        const cachedWinningStrategy = preferredStrategy
            ? null
            : await getCachedWinningStrategy(chainId, poolTokenIn, poolTokenOut);
        const requestedMode: DirectSwapExecutionMode = params.executionMode === 'turbo' ? 'turbo' : 'balanced';
        const fastHintMode = Boolean(params.hint?.sourceTxHash);
        const turboMode = requestedMode === 'turbo';
        const autoBypassReferenceGate = fastHintMode && !!preferredStrategy && (
            preferredStrategy.kind === 'v4'
            || preferredStrategy.kind === 'infinity'
            || preferredStrategy.kind === 'aerodrome'
        );
        const bypassReferenceGate = (params.hint?.bypassReferencePrice === true && !!preferredStrategy) || autoBypassReferenceGate;
        const skipReferenceQuote = bypassReferenceGate || turboMode;
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
        const turboFastDeadline = swapStart + DIRECT_SWAP_FASTPATH_BUDGET_MS;
        let earlyHintedPool: HintedSourcePool | null = null;
        if (params.hint?.resolvedPoolHint) {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint attempt', {
                chainId,
                kind: params.hint.resolvedPoolHint.kind,
                dex: params.hint.resolvedPoolHint.dex,
                poolAddress: params.hint.resolvedPoolHint.poolAddress
            });

            const directTry = await tryResolvedPoolHintFastPath(normalizedParams, params.hint);
            if (directTry?.success) {
                return finish(directTry);
            }

            // Balanced mode: one cheap hint attempt then continue normal flow.
            if (!turboMode) {
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved pool hint unavailable in balanced mode, continue discovery', {
                    chainId,
                    error: directTry?.error
                });
            } else {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast-path resolved pool hint failed, retry once', {
                    chainId,
                    error: directTry?.error
                });
                const retryTry = await tryResolvedPoolHintFastPath(normalizedParams, params.hint);
                if (retryTry?.success) {
                    return finish(retryTry);
                }

                if (Date.now() >= turboFastDeadline) {
                    return finish({
                        success: false,
                        error: 'Fast-path budget exceeded after resolved-pool attempts',
                        provider: 'failed'
                    });
                }
            }
        }
        if (turboMode && params.hint?.sourceTxHash && !params.hint?.resolvedPoolHint) {
            const earlyHintBudgetMs = Math.max(200, Math.min(1200, turboFastDeadline - Date.now()));
            if (earlyHintBudgetMs > 0) {
                earlyHintedPool = await withTimeout(
                    resolveHintedPoolFromSourceTx(poolTokenIn, poolTokenOut, chainId, params.hint),
                    earlyHintBudgetMs
                ).catch(() => null);
                if (earlyHintedPool?.kind === 'v4') {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Early hinted source pool selected (v4)', {
                        chainId,
                        strategy: 'v4-hinted-source-early',
                        poolId: earlyHintedPool.pool.poolAddress,
                        fee: earlyHintedPool.pool.poolKey.fee
                    });
                    return finish(await executeV4Swap(normalizedParams, earlyHintedPool.pool, {
                        allowZeroQuoteMinOut: true,
                        fastMode: turboMode,
                        executionMode: requestedMode,
                        trustedHint: true
                    }));
                }
                if (earlyHintedPool?.kind === 'v3') {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Early hinted source pool selected (v3)', {
                        chainId,
                        strategy: `v3-hinted-source-early:${earlyHintedPool.dex}`,
                        pool: earlyHintedPool.pool.poolAddress,
                        fee: earlyHintedPool.pool.fee
                    });
                    return finish(await executeV3Swap(normalizedParams, earlyHintedPool.pool, earlyHintedPool.dex, {
                        fastMode: turboMode,
                        executionMode: requestedMode
                    }));
                }
                if (earlyHintedPool?.kind === 'v2') {
                    const hintedV2Quote = await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
                    if (hintedV2Quote > 0n) {
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] Early hinted source pool selected (v2)', {
                            chainId,
                            strategy: `v2-hinted-source-early:${earlyHintedPool.dex || 'uniswap'}`,
                            pool: earlyHintedPool.pool.poolAddress,
                            amountOut: hintedV2Quote.toString()
                        });
                        return finish(await executeV2Swap(normalizedParams, hintedV2Quote));
                    }
                }
            }
        }
        let infinityPrecheckFailed = false;

        let forceV4 = false;
        let preloadedV4Pools: V4PoolInfo[] | null = null;
        if (isV4SwapSupported(chainId) && !turboMode) {
            try {
                preloadedV4Pools = await findV4Pools(poolTokenIn, poolTokenOut, chainId);
                forceV4 = preloadedV4Pools.some((p) => {
                    const family = resolveV4HookProfile(chainId, p.poolKey.hooks).family;
                    if (family === 'clanker') return true;
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
            cachedReferenceQuote = referenceQuote;

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 fast path quote check', {
                v4Quote: v4Best.amountOut.toString().slice(0, 15),
                referenceQuote: referenceQuote.toString().slice(0, 15),
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

            if (v4Best.pool && v4Best.amountOut > 0n && referenceQuote > 0n) {
                const deviationBps = Math.min(Math.max(REFERENCE_DEVIATION_BPS, 0), 5000);
                const minReasonable = referenceQuote * BigInt(10000 - deviationBps) / 10000n;
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
                    : referenceQuote <= 0n ? 'reference_quote_unavailable'
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
        const skipPoolDiscovery = turboMode && Boolean(params.hint?.sourceTxHash);
        if (turboMode && Date.now() >= turboFastDeadline) {
            return finish({ success: false, error: 'Fast-path budget exceeded before pool discovery', provider: 'failed' });
        }
        if (skipPoolDiscovery) {
            pools = [];
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery skipped in fast-hint mode', {
                chainId,
                preferredStrategy: preferredStrategy?.kind
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
                    timeoutMs: turboMode
                        ? (infinityPrecheckFailed ? 5000 : DIRECT_SWAP_HINT_POOL_TIMEOUT_MS)
                        : 5000
                });
            }
        }
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery complete', {
            poolCount: pools.length,
            durationMs: Date.now() - poolStart
        });
        tPoolDiscoveryDone = Date.now();

        if (pools.length === 0) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] No pool found for token pair', {
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                chainId
            });

            // Hard fail fast: if source hints v4 but we have no resolved hint and no discovered pool,
            // continuing into virtual/zora fallbacks is usually wasted latency.
            if (
                fastHintMode
                && preferredStrategy?.kind === 'v4'
                && !params.hint?.resolvedPoolHint
                && !earlyHintedPool
            ) {
                logger.warn(LogCode.SYS_INFO, '[DirectSwap] Fast fail: no pool from hint and discovery', {
                    chainId,
                    hintSourceTx: params.hint?.sourceTxHash
                });
                return finish({ success: false, error: 'No suitable pool found', provider: 'failed' });
            }

            // Sniper safeguard: source tx may carry a resolvable pool even when static discovery misses it.
            if (params.hint?.sourceTxHash) {
                const hintedPool = earlyHintedPool || await withTimeout(
                    resolveHintedPoolFromSourceTx(poolTokenIn, poolTokenOut, chainId, params.hint),
                    turboMode ? Math.max(120, Math.min(450, turboFastDeadline - Date.now())) : 1200
                ).catch(() => null);
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
                const v3Pool = pickBestPool(pools, 'v3', v3Dex);
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
                const v2Pool = pickBestPool(pools, 'v2', preferredStrategy.dex);
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

        const referenceQuote = skipReferenceQuote
            ? 0n
            : (cachedReferenceQuote ?? await getReferenceExpectedOutput(
                normalizedTokenIn,
                normalizedTokenOut,
                amountInWei,
                chainId,
                params.slippageBps,
                params.walletAddress,
                { enableZoraRoutes: zoraRoutesEnabled }
            ));

        const canUseSourceHintFallback = !!params.hint?.sourceTxHash;
        if (referenceQuote <= 0n && !canUseSourceHintFallback && !turboMode) {
            return finish({ success: false, error: 'No valid reference price (0x/Kyber/Gecko)', provider: 'failed' });
        }
        if (referenceQuote <= 0n && canUseSourceHintFallback) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Reference quote unavailable, continuing with source hint fallback', {
                chainId,
                txHash: params.hint?.sourceTxHash
            });
        }
        if (referenceQuote <= 0n && !preferredStrategy && !turboMode) {
            return finish({ success: false, error: 'No valid reference price and no trusted hint strategy', provider: 'failed' });
        }
        if (referenceQuote <= 0n && turboMode) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] Turbo mode continuing without reference quote', {
                chainId,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'infinity',
                    reason: !infinityQuote ? 'quote_unavailable' : 'quote_below_threshold',
                    amountOut: infinityQuote?.amountOut?.toString() || '0',
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v4') {
                if (!isV4SwapSupported(chainId)) continue;
                if ((preloadedV4Pools?.length || 0) === 0 && !params.hint?.resolvedPoolHint && !earlyHintedPool) {
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                        strategy: 'v4',
                        reason: 'pool_unavailable_preloaded_empty',
                        amountOut: '0',
                        minReasonable: minReasonable.toString()
                    });
                    continue;
                }
                if (turboMode && params.hint?.sourceTxHash) {
                    const turboHintedPool: HintedSourcePool | null = earlyHintedPool
                        || await withTimeout(
                            resolveHintedPoolFromSourceTx(poolTokenIn, poolTokenOut, chainId, params.hint),
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'v4',
                    reason: !v4Best.pool ? 'pool_unavailable' : 'quote_below_threshold',
                    amountOut: v4Best.amountOut.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v3') {
                if (!strategy.dex || (strategy.dex !== 'uniswap' && strategy.dex !== 'pancake')) continue;
                const v3Pool = pickBestPool(pools, 'v3', strategy.dex);
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
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
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy skipped', {
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
                    strategy: 'aerodrome',
                    reason: 'quote_below_threshold',
                    amountOut: aeroQuote.toString(),
                    minReasonable: minReasonable.toString()
                });
                continue;
            }

            if (strategy.kind === 'v2') {
                const v2Pool = pickBestPool(pools, 'v2', strategy.dex);
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
                logger.info(LogCode.SYS_INFO, '[DirectSwap] Strategy rejected', {
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

    let bestOut = 0n;
    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    for (const fee of feeTiers) {
        try {
            const quoteParams = {
                tokenIn,
                tokenOut,
                amountIn: amountInWei,
                fee: fee,
                sqrtPriceLimitX96: 0
            };
            const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
            const result = await callRpc<string>(chainId, 'eth_call', [{
                to: quoter,
                data: callData
            }, 'latest']);
            if (!result || result === '0x') continue;
            const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
            const amountOut = decoded[0] as bigint;
            if (amountOut > bestOut) bestOut = amountOut;
        } catch {
            continue;
        }
    }
    return bestOut;
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

const INFINITY_COMMANDS = {
    INFI_SWAP: 0x10,
    WRAP_ETH: 0x0b,
    UNWRAP_WETH: 0x0c
};

const INFINITY_ACTIONS = {
    CL_SWAP_EXACT_IN_SINGLE: 0x06,
    BIN_SWAP_EXACT_IN_SINGLE: 0x1c,
    SETTLE: 0x0b,
    SETTLE_ALL: 0x0c,
    TAKE: 0x0e,
    TAKE_ALL: 0x0f
};

const INFINITY_ACTION_CONSTANTS = {
    OPEN_DELTA: 0n,
    CONTRACT_BALANCE: 1n << 255n,
    MSG_SENDER: '0x0000000000000000000000000000000000000001'
};

const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

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

    let best: InfinityBestQuote | null = null;

    const cachedPoolKeys = await loadInfinityPoolKeys(chainId, normalizedIn, normalizedOut);
    if (cachedPoolKeys.length) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Infinity cache hit', {
            chainId,
            tokenIn: normalizedIn.slice(0, 10),
            tokenOut: normalizedOut.slice(0, 10),
            poolKeyCount: cachedPoolKeys.length
        });
        for (const poolKey of cachedPoolKeys) {
            const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn.toLowerCase();
            const isCl = poolKey.poolManager.toLowerCase() === PANCAKE_INFINITY_CL_POOL_MANAGER.toLowerCase();
            const quoter = isCl ? PANCAKE_INFINITY_CL_QUOTER : PANCAKE_INFINITY_BIN_QUOTER;
            const amountOut = await quoteInfinityExactInputSingle(
                quoter,
                { poolKey, zeroForOne, amountIn: amountInWei },
                chainId
            );
            if (amountOut > (best?.amountOut || 0n)) {
                best = {
                    amountOut,
                    poolKey,
                    zeroForOne,
                    kind: isCl ? 'cl' : 'bin',
                    fee: poolKey.fee,
                    tickSpacing: isCl ? parseInfinityParameterValue(poolKey.parameters) : undefined,
                    binStep: isCl ? undefined : parseInfinityParameterValue(poolKey.parameters)
                };
            }
        }
        if (best) return best;
    }

    for (const fee of INFINITY_CL_FEE_TIERS) {
        const tickSpacing = INFINITY_CL_TICK_SPACING_BY_FEE[fee];
        if (!tickSpacing) continue;
        const parameters = encodeInfinityParameters(tickSpacing);
        const { poolKey, zeroForOne } = buildInfinityPoolKey(
            normalizedIn,
            normalizedOut,
            PANCAKE_INFINITY_CL_POOL_MANAGER,
            fee,
            parameters
        );
        const amountOut = await quoteInfinityExactInputSingle(
            PANCAKE_INFINITY_CL_QUOTER,
            { poolKey, zeroForOne, amountIn: amountInWei },
            chainId
        );
        if (amountOut > (best?.amountOut || 0n)) {
            best = { amountOut, poolKey, zeroForOne, kind: 'cl', fee, tickSpacing };
        }
    }

    for (const fee of INFINITY_CL_FEE_TIERS) {
        for (const binStep of INFINITY_BIN_STEPS) {
            const parameters = encodeInfinityParameters(binStep);
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn,
                normalizedOut,
                PANCAKE_INFINITY_BIN_POOL_MANAGER,
                fee,
                parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_BIN_QUOTER,
                { poolKey, zeroForOne, amountIn: amountInWei },
                chainId
            );
            if (amountOut > (best?.amountOut || 0n)) {
                best = { amountOut, poolKey, zeroForOne, kind: 'bin', fee, binStep };
            }
        }
    }

    return best;
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

async function findV4InitLogByPoolId(
    chainId: number,
    poolManager: string,
    poolId: string,
    anchorBlockHex?: string
): Promise<any | null> {
    const MAX_BLOCK_RANGE = 3000n;
    const MAX_WINDOWS = 6; // keep lookup bounded for copytrade latency
    let toBlock = anchorBlockHex ? BigInt(anchorBlockHex) : BigInt(await callRpc<string>(chainId, 'eth_blockNumber', [], { strategy: 'fast' }));

    for (let i = 0; i < MAX_WINDOWS && toBlock >= 0n; i++) {
        const fromBlock = toBlock > MAX_BLOCK_RANGE ? (toBlock - MAX_BLOCK_RANGE) : 0n;
        try {
            const logs = await withTimeout(
                callRpc<any[]>(
                    chainId,
                    'eth_getLogs',
                    [{
                        address: poolManager,
                        fromBlock: ethers.toQuantity(fromBlock),
                        toBlock: ethers.toQuantity(toBlock),
                        topics: [V4_INIT_EVENT, poolId]
                    }],
                    { strategy: 'cheap' }
                ),
                600
            );
            if (Array.isArray(logs) && logs.length > 0) {
                return logs[0];
            }
        } catch {
            // move window and keep trying
        }
        if (fromBlock === 0n) break;
        toBlock = fromBlock - 1n;
    }

    return null;
}

async function resolveHintedV4PoolFromSourceTx(
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    hint?: DirectSwapHint
): Promise<SelectedV4Pool | null> {
    if (chainId !== 8453 || !hint?.sourceTxHash) return null;

    const cacheKey = `${chainId}:${hint.sourceTxHash.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
    if (hintedV4PoolCache.has(cacheKey)) {
        return hintedV4PoolCache.get(cacheKey) || null;
    }

    try {
        const receipt = await callRpc<any>(chainId, 'eth_getTransactionReceipt', [hint.sourceTxHash], { strategy: 'fast' });
        const receiptLogs = Array.isArray(receipt?.logs) ? receipt.logs : [];
        const swapLogs = receiptLogs.filter((log: any) =>
            log?.topics?.[0]?.toLowerCase?.() === V4_SWAP_EVENT.toLowerCase() && log?.topics?.[1]
        );
        if (!swapLogs.length) {
            hintedV4PoolCache.set(cacheKey, null);
            return null;
        }

        const inLower = tokenIn.toLowerCase();
        const outLower = tokenOut.toLowerCase();

        for (const swapLog of swapLogs) {
            const poolId = swapLog.topics[1];
            const poolManager = swapLog.address;
            if (!poolId || !poolManager) continue;

            // Fast path: resolve PoolKey from known V4 configs without wide log scans.
            const quickMatchedKey = matchV4PoolKeyById(chainId, poolId, tokenIn, tokenOut, null);
            if (quickMatchedKey) {
                const quickInfo = await getV4PoolInfo(quickMatchedKey, chainId, { strategy: 'fast' });
                if (quickInfo && BigInt(quickInfo.liquidity) > 0n) {
                    const [meta0, meta1] = await Promise.all([
                        getTokenMetadata(chainId, quickInfo.poolKey.currency0),
                        getTokenMetadata(chainId, quickInfo.poolKey.currency1)
                    ]);
                    const quickSelected: SelectedV4Pool = {
                        poolId: quickInfo.poolId,
                        poolAddress: quickInfo.poolId,
                        poolKey: quickInfo.poolKey,
                        token0: quickInfo.poolKey.currency0,
                        token1: quickInfo.poolKey.currency1,
                        liquidity: quickInfo.liquidity,
                        sqrtPriceX96: quickInfo.sqrtPriceX96,
                        fee: quickInfo.lpFee,
                        price: calculatePriceFromSqrtX96(
                            BigInt(quickInfo.sqrtPriceX96),
                            meta0.decimals || 18,
                            meta1.decimals || 18
                        ),
                        version: 'v4',
                        dex: 'uniswap'
                    };
                    hintedV4PoolCache.set(cacheKey, quickSelected);
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved hinted V4 pool by poolId match', {
                        txHash: hint.sourceTxHash,
                        poolId: quickInfo.poolId,
                        hook: quickInfo.poolKey.hooks,
                        fee: quickInfo.poolKey.fee,
                        tickSpacing: quickInfo.poolKey.tickSpacing
                    });
                    return quickSelected;
                }
            }

            let initLog = receiptLogs.find((log: any) =>
                log?.address?.toLowerCase?.() === String(poolManager).toLowerCase()
                && log?.topics?.[0]?.toLowerCase?.() === V4_INIT_EVENT.toLowerCase()
                && log?.topics?.[1]?.toLowerCase?.() === String(poolId).toLowerCase()
            );

            if (!initLog) {
                initLog = await findV4InitLogByPoolId(chainId, poolManager, poolId, receipt?.blockNumber);
            }

            if (!initLog) continue;

            let parsed: ethers.LogDescription | null = null;
            try {
                parsed = v4InitEventInterface.parseLog({ topics: initLog.topics, data: initLog.data });
            } catch {
                parsed = null;
            }
            if (!parsed) continue;

            const currency0 = ethers.getAddress(String(parsed.args.currency0));
            const currency1 = ethers.getAddress(String(parsed.args.currency1));
            const pairMatches =
                (currency0.toLowerCase() === inLower && currency1.toLowerCase() === outLower)
                || (currency0.toLowerCase() === outLower && currency1.toLowerCase() === inLower);
            if (!pairMatches) continue;

            const poolKey: V4PoolKey = {
                currency0,
                currency1,
                fee: Number(parsed.args.fee),
                tickSpacing: Number(parsed.args.tickSpacing),
                hooks: ethers.getAddress(String(parsed.args.hooks))
            };

            const info = await getV4PoolInfo(poolKey, chainId, { strategy: 'fast' });
            if (!info || BigInt(info.liquidity) <= 0n) continue;

            const [meta0, meta1] = await Promise.all([
                getTokenMetadata(chainId, info.poolKey.currency0),
                getTokenMetadata(chainId, info.poolKey.currency1)
            ]);
            const selected: SelectedV4Pool = {
                poolId: info.poolId,
                poolAddress: info.poolId,
                poolKey: info.poolKey,
                token0: info.poolKey.currency0,
                token1: info.poolKey.currency1,
                liquidity: info.liquidity,
                sqrtPriceX96: info.sqrtPriceX96,
                fee: info.lpFee,
                price: calculatePriceFromSqrtX96(
                    BigInt(info.sqrtPriceX96),
                    meta0.decimals || 18,
                    meta1.decimals || 18
                ),
                version: 'v4',
                dex: 'uniswap'
            };

            hintedV4PoolCache.set(cacheKey, selected);
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved hinted V4 pool from source tx', {
                txHash: hint.sourceTxHash,
                poolId: info.poolId,
                hook: info.poolKey.hooks,
                fee: info.poolKey.fee,
                tickSpacing: info.poolKey.tickSpacing
            });
            return selected;
        }
    } catch (err: any) {
        logger.debug(LogCode.SYS_INFO, '[DirectSwap] Failed to resolve hinted V4 pool', {
            txHash: hint?.sourceTxHash,
            error: err?.message?.slice(0, 120)
        });
    }

    hintedV4PoolCache.set(cacheKey, null);
    return null;
}

function hintedPoolPairMatches(pool: PoolInfo, tokenIn: string, tokenOut: string): boolean {
    const a = tokenIn.toLowerCase();
    const b = tokenOut.toLowerCase();
    const p0 = String(pool.token0 || '').toLowerCase();
    const p1 = String(pool.token1 || '').toLowerCase();
    return (p0 === a && p1 === b) || (p0 === b && p1 === a);
}

function resolveHintedV2Dex(chainId: number, hint?: DirectSwapHint): DexFamily {
    const dexName = String(hint?.sourceDexName || '').toLowerCase();
    if (dexName.includes('aerodrome') || dexName.includes('velodrome')) return 'aerodrome';
    if (dexName.includes('pancake') || chainId === 56) return 'pancake';
    return 'uniswap';
}

async function resolveHintedPoolFromSourceTx(
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    hint?: DirectSwapHint
): Promise<HintedSourcePool | null> {
    if (!hint?.sourceTxHash) return null;
    const cacheKey = `${chainId}:${hint.sourceTxHash.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
    if (hintedPoolCache.has(cacheKey)) {
        return hintedPoolCache.get(cacheKey) || null;
    }

    try {
        const hintedV4 = await resolveHintedV4PoolFromSourceTx(tokenIn, tokenOut, chainId, hint);
        if (hintedV4) {
            const result: HintedSourcePool = { kind: 'v4', pool: hintedV4, dex: chainId === 56 ? 'pancake' : 'uniswap' };
            hintedPoolCache.set(cacheKey, result);
            return result;
        }

        const receipt = await callRpc<any>(chainId, 'eth_getTransactionReceipt', [hint.sourceTxHash], { strategy: 'fast' });
        const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
        if (!logs.length) {
            hintedPoolCache.set(cacheKey, null);
            return null;
        }

        const v3Addrs = new Set<string>();
        const v2Addrs = new Set<string>();
        for (const log of logs) {
            const topic0 = String(log?.topics?.[0] || '').toLowerCase();
            const address = String(log?.address || '').toLowerCase();
            if (!address) continue;
            if (topic0 === V3_SWAP_EVENT.toLowerCase()) v3Addrs.add(address);
            if (topic0 === V2_SWAP_EVENT.toLowerCase()) v2Addrs.add(address);
        }

        for (const poolAddress of v3Addrs) {
            const pool = await getV3PoolInfo(poolAddress, chainId);
            if (!pool) continue;
            if (!hintedPoolPairMatches(pool, tokenIn, tokenOut)) continue;
            if (BigInt(pool.liquidity || '0') <= 0n) continue;
            const result: HintedSourcePool = { kind: 'v3', pool, dex: chainId === 56 ? 'pancake' : 'uniswap' };
            hintedPoolCache.set(cacheKey, result);
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved hinted v3 pool from source tx', {
                txHash: hint.sourceTxHash,
                pool: pool.poolAddress,
                fee: pool.fee,
                dex: result.dex
            });
            return result;
        }

        for (const poolAddress of v2Addrs) {
            const pool = await getV2PoolInfo(poolAddress, chainId);
            if (!pool) continue;
            if (!hintedPoolPairMatches(pool, tokenIn, tokenOut)) continue;
            if ((BigInt(pool.reserve0 || '0') + BigInt(pool.reserve1 || '0')) <= 0n) continue;
            const result: HintedSourcePool = { kind: 'v2', pool, dex: resolveHintedV2Dex(chainId, hint) };
            hintedPoolCache.set(cacheKey, result);
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Resolved hinted v2 pool from source tx', {
                txHash: hint.sourceTxHash,
                pool: pool.poolAddress,
                dex: result.dex
            });
            return result;
        }
    } catch (err: any) {
        logger.debug(LogCode.SYS_INFO, '[DirectSwap] Failed to resolve hinted pool from source tx', {
            txHash: hint?.sourceTxHash,
            error: err?.message?.slice(0, 120)
        });
    }

    hintedPoolCache.set(cacheKey, null);
    return null;
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
        ? await resolveHintedV4PoolFromSourceTx(tokenIn, tokenOut, chainId, hint)
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
    options?: { enableZoraRoutes?: boolean }
): Promise<bigint> {
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

        let best = sourceCandidates[0];
        for (const candidate of sourceCandidates) {
            if (candidate.amountOut > best.amountOut) best = candidate;
        }

        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] On-chain reference quote', {
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12),
            bestSource: best.source,
            bestOut: best.amountOut.toString().slice(0, 15),
            bySource: sourceCandidates
                .map(s => `${s.source}:${s.amountOut.toString().slice(0, 12)}`)
                .join(',')
        });

        return best.amountOut > 0n ? best.amountOut : 0n;
    }
    const cacheKey = `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountInWei.toString()}`;
    const cached = referenceQuoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REFERENCE_QUOTE_TTL_MS) {
        return cached.value;
    }
    const redisCached = await cacheGet(referenceQuoteRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < REFERENCE_QUOTE_TTL_MS) {
                const value = BigInt(parsed.value);
                referenceQuoteCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    const refStart = Date.now();

    let ref0x = 0n;
    let refKyber = 0n;
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
        ref0x = zeroExResult.value;
    } else {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x reference quote failed', {
            error: String(zeroExResult.reason?.message || zeroExResult.reason || '').slice(0, 80)
        });
    }
    if (kyberResult.status === 'fulfilled') {
        refKyber = kyberResult.value;
    } else {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Kyber reference quote failed', {
            error: String(kyberResult.reason?.message || kyberResult.reason || '').slice(0, 80)
        });
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
            ref0x: ref0x.toString().slice(0, 15),
            refKyber: refKyber.toString().slice(0, 15),
            durationMs: Date.now() - refStart
        });
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
                outWei: v4Spot.toString().slice(0, 15),
                durationMs: Date.now() - refStart
            });
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
                    outWei: outWei.toString().slice(0, 15),
                    durationMs: Date.now() - refStart
                });
                return outWei;
            }
        }
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Gecko reference failed', {
            error: err?.message?.slice(0, 80)
        });
    }

    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] No reference quote available', {
        durationMs: Date.now() - refStart
    });
    return 0n;
}

async function executeV2Swap(
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
    expectedOut: bigint
): Promise<DirectSwapResult> {
    const router = V2_ROUTERS[params.chainId];
    if (!router) return { success: false, error: 'V2 router not available', provider: 'failed' };

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[params.chainId];
    if (!weth) return { success: false, error: 'WETH not configured', provider: 'failed' };

    const amountInWei = params.amountInWei;
    const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS;
    const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS;

    const normalizedIn = isNativeIn ? weth : params.tokenIn;
    const normalizedOut = isNativeOut ? weth : params.tokenOut;

    const minAmountOut = expectedOut > 0n
        ? expectedOut * BigInt(10000 - params.slippageBps) / BigInt(10000)
        : 0n;

    const deadline = Math.floor(Date.now() / 1000) + 300;
    const data = isNativeIn
        ? v2RouterInterface.encodeFunctionData('swapExactETHForTokens', [
            minAmountOut,
            [normalizedIn, normalizedOut],
            params.walletAddress,
            deadline
        ])
        : isNativeOut
            ? v2RouterInterface.encodeFunctionData('swapExactTokensForETH', [
                amountInWei,
                minAmountOut,
                [normalizedIn, normalizedOut],
                params.walletAddress,
                deadline
            ])
            : v2RouterInterface.encodeFunctionData('swapExactTokensForTokens', [
                amountInWei,
                minAmountOut,
                [normalizedIn, normalizedOut],
                params.walletAddress,
                deadline
            ]);

    let gasLimit: string;
    try {
        const estimate = await callRpc<string>(params.chainId, 'eth_estimateGas', [{
            from: params.walletAddress,
            to: router,
            data: data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }]);
        gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
        gasLimit = '350000';
    }

    const txHash = await sendTransaction(params.userId, params.accessToken, {
        to: router,
        data: data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId: params.chainId,
        executionProfile: getTxExecutionProfile(params.chainId),
        gas: gasLimit
    });

    return {
        success: true,
        txHash,
        provider: params.chainId === 56 ? 'pancake-v2' : 'uniswap-v2',
        poolInfo: {
            version: 'v2',
            fee: 0,
            liquidity: '0'
        }
    };
}

/**
 * 执行 V4 交易
 */
async function executeV4Swap(
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
    pool: SelectedV4Pool,
    options?: {
        allowZeroQuoteMinOut?: boolean;
        fastMode?: boolean;
        executionMode?: DirectSwapExecutionMode;
        trustedHint?: boolean;
    }
): Promise<DirectSwapResult> {
    const { userId, accessToken, tokenIn, tokenOut, chainId, slippageBps } = params;
    const plan = buildV4ExecutionPlan({
        tokenIn,
        tokenOut,
        chainId,
        walletAddress: params.walletAddress,
        pool
    });
    const { isNativeIn, isNativeOut, normalizedIn, normalizedOut, zeroForOne, hookDataCandidates, hookFamily, poolKey, poolId } = plan;

    logger.info(LogCode.SYS_INFO, '[DirectSwap] Using V4 pool', {
        chainId,
        poolId,
        hook: poolKey.hooks,
        hookFamily,
        hookCandidates: hookDataCandidates.length,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        currency0: poolKey.currency0,
        currency1: poolKey.currency1
    });



    // 计算金额 (wei)
    const amountInWei = params.amountInWei;
    const fastMode = options?.fastMode === true;
    const executionMode: DirectSwapExecutionMode = options?.executionMode === 'turbo' ? 'turbo' : 'balanced';
    const trustedHint = options?.trustedHint === true;

    // [Safety]: 使用 V4 Pool 的 spot price + Quoter 做报价偏离校验，避免极端误报价
    let quoterOutWei = 0n;
    let selectedHookData = hookDataCandidates[0] || '0x';

    let gasPriceWei: bigint | undefined;
    if (!fastMode) {
        try {
            const gasPriceHex = await callRpc<string>(chainId, 'eth_gasPrice', [], {
                strategy: 'fast',
                importance: 'critical'
            });
            gasPriceWei = gasPriceHex ? BigInt(gasPriceHex) : undefined;
        } catch {
            gasPriceWei = undefined;
        }
    }

    if (!fastMode) {
        let bestOut = 0n;
        let bestHookData = selectedHookData;
        for (const hookData of hookDataCandidates) {
            const quote = await callV4QuoterExactOut(
                poolKey,
                zeroForOne,
                amountInWei,
                chainId,
                params.walletAddress,
                gasPriceWei,
                [hookData]
            );
            if (quote > bestOut) {
                bestOut = quote;
                bestHookData = hookData;
            }
        }
        quoterOutWei = bestOut;
        selectedHookData = bestHookData;
    }
    let baseOutWei = quoterOutWei;
    if (!fastMode && baseOutWei <= 0n) {
        const fallbackBest = await getV4BestPoolQuote(normalizedIn!, normalizedOut!, amountInWei, chainId, params.walletAddress);
        baseOutWei = fallbackBest.amountOut;
    }
    const allowZeroQuoteMinOut = options?.allowZeroQuoteMinOut === true || fastMode;
    if (baseOutWei <= 0n && !allowZeroQuoteMinOut) {
        return { success: false, error: 'V4 spot price unavailable', provider: 'failed' };
    }

    const minAmountOut = baseOutWei > 0n
        ? baseOutWei * BigInt(10000 - slippageBps) / BigInt(10000)
        : 0n;

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 minAmountOut calculated', {
        quoterOut: quoterOutWei.toString().slice(0, 15),
        minAmountOut: minAmountOut.toString().slice(0, 15),
        selectedHookData: selectedHookData.slice(0, 10),
        slippageBps,
        allowZeroQuoteMinOut
    });

    // 构建交易
    const deadline = Math.floor(Date.now() / 1000) + 300;


    const buildTx = (hookData: string) => buildV4SwapTransaction(
        chainId,
        poolKey,
        zeroForOne,
        amountInWei,
        minAmountOut,
        params.walletAddress,
        deadline,
        isNativeIn,
        isNativeOut,
        hookData
    );
    let tx = buildTx(selectedHookData);

    const turboTrustedFastPath = executionMode === 'turbo' && trustedHint;
    // [Safety]: 预模拟交易，避免明显回滚
    if (!fastMode && !turboTrustedFastPath) {
        try {
            await callRpc<string>(chainId, 'eth_call', [{
                from: params.walletAddress,
                to: tx.to,
                data: tx.data,
                value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
            }, 'latest'], {
                strategy: 'fast',
                importance: 'critical'
            });
        } catch (err: any) {
            const errSummary = summarizeRpcError(err);
            const reason = errSummary.reason;
            let recoveredByCandidate = false;
            if (hookDataCandidates.length > 1) {
                for (const candidate of hookDataCandidates) {
                    if (candidate === selectedHookData) continue;
                    try {
                        const candidateTx = buildTx(candidate);
                        await callRpc<string>(chainId, 'eth_call', [{
                            from: params.walletAddress,
                            to: candidateTx.to,
                            data: candidateTx.data,
                            value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
                        }, 'latest'], {
                            strategy: 'fast',
                            importance: 'critical'
                        });
                        selectedHookData = candidate;
                        tx = candidateTx;
                        recoveredByCandidate = true;
                        logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 hook candidate fallback accepted', {
                            chainId,
                            poolId,
                            hook: poolKey.hooks,
                            hookFamily,
                            selectedHookData: selectedHookData.slice(0, 10)
                        });
                        break;
                    } catch {
                        // try next hookData candidate
                    }
                }
            }
            if (recoveredByCandidate) {
                // continue execution
            } else
            if (reason && (reason.toLowerCase().includes('not open') || reason.toLowerCase().includes('chill bro'))) {
                logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 clanker gate', {
                    reason,
                    wallet: params.walletAddress,
                    hook: poolKey.hooks,
                    poolId,
                    tokenIn: normalizedIn,
                    tokenOut: normalizedOut
                });
                return { success: false, error: `clanker_gate:${reason}`, provider: 'uniswap-v4' };
            } else {
                logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation failed', {
                error: errSummary.shortMessage,
                errorCode: errSummary.code,
                revertReason: reason,
                errorData: errSummary.dataPreview,
                transientRpcFailure: isTransientRpcFailureForPreSim(errSummary),
                hookFamily,
                poolId,
                hook: poolKey.hooks,
                minAmountOut: minAmountOut.toString(),
                amountInWei: amountInWei.toString(),
                isNativeIn,
                isNativeOut
                });
                if (isTransientRpcFailureForPreSim(errSummary)) {
                    logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation skipped due to transient RPC failure', {
                    poolId,
                    hook: poolKey.hooks,
                    tokenIn: normalizedIn,
                    tokenOut: normalizedOut,
                    error: errSummary.shortMessage,
                    errorCode: errSummary.code
                    });
                } else if (executionMode === 'turbo') {
                    logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation soft-fail in turbo mode', {
                    poolId,
                    hook: poolKey.hooks,
                    tokenIn: normalizedIn,
                    tokenOut: normalizedOut,
                    error: errSummary.shortMessage,
                    revertReason: reason
                    });
                } else {
                    const hookFailurePrefix = hookFamily === 'unknown' ? 'unsupported_hook' : 'hook_candidate_failed';
                    return { success: false, error: `${hookFailurePrefix}:${reason || 'pre_sim_failed'}`, provider: 'failed' };
                }
            }
        }
    } else if (turboTrustedFastPath) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 pre-simulation skipped (turbo trusted hint)', {
            chainId,
            poolId,
            hook: poolKey.hooks
        });
    }

    // [Logic]: 动态估算 V4 swap gas（包含复杂 ERC20 transfer），并增加 buffer
    // [Risk]: 部分代币 transfer 更耗 gas，固定 350k 容易 OOG
    let gasLimit: string;
    const gasCacheKey = v4GasCacheKey(chainId, poolId, normalizedIn!, normalizedOut!);
    const cachedGasLimit = getCachedV4GasLimit(gasCacheKey);
    if (fastMode) {
        gasLimit = cachedGasLimit || DIRECT_SWAP_TURBO_V4_GAS_LIMIT;
    } else {
        if (turboTrustedFastPath && cachedGasLimit) {
            gasLimit = cachedGasLimit;
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Using cached V4 gas limit (turbo trusted hint)', {
                chainId,
                poolId,
                gasLimit
            });
        } else if (turboTrustedFastPath) {
            gasLimit = DIRECT_SWAP_TURBO_V4_GAS_LIMIT;
        } else {
        try {
            const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
                from: params.walletAddress,
                to: tx.to,
                data: tx.data,
                value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
            }]);

            const estimatedGas = BigInt(estimate);
            const buffered = estimatedGas * 2n; // 2x buffer for heavy transfer tokens
            gasLimit = buffered.toString();
            setCachedV4GasLimit(gasCacheKey, gasLimit);

            logger.info(LogCode.API_FETCH_SUCCESS, '[DirectSwap] V4 gas estimated', {
                estimatedGas: estimatedGas.toString(),
                gasLimit
            });
        } catch (err: any) {
            const V4_GAS_FALLBACK = 900000; // fallback for heavy tokens
            gasLimit = V4_GAS_FALLBACK.toString();
            logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V4 gas estimate failed, using fallback', {
                error: err?.message?.slice(0, 120),
                gasLimit
            });
        }
        }
    }

    // 发送交易
    // [Logic]: 如果输入是 ETH，需要发送 ETH value；否则 value=0
    const txHash = await sendTransaction(userId, accessToken, {
        to: tx.to,
        data: tx.data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        executionProfile: getTxExecutionProfile(chainId),
        gas: gasLimit
    });

    logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V4 swap executed', {
        txHash,
        poolId: poolId.slice(0, 20),
        hookFamily,
        selectedHookData: selectedHookData.slice(0, 10)
    });

    return {
        success: true,
        txHash,
        provider: 'uniswap-v4',
        poolInfo: {
            version: 'v4',
            fee: pool.fee || 0,
            liquidity: pool.liquidity
        }
    };
}

/**
 * 执行 Pancake Infinity 交易 (BSC)
 */
async function executeInfinitySwap(
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
    quote: InfinityBestQuote,
    options?: { executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, chainId, slippageBps } = params;
    if (chainId !== 56) {
        return { success: false, error: 'Infinity only supported on BSC', provider: 'failed' };
    }

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) {
        return { success: false, error: 'WBNB not configured', provider: 'failed' };
    }

    const amountInWei = params.amountInWei;
    const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase();

    const normalizedIn = isNativeIn ? weth : params.tokenIn;
    const normalizedOut = isNativeOut ? weth : params.tokenOut;

    if (isNativeOut) {
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Infinity native-out not supported, using WBNB output', {
            tokenOut: params.tokenOut.slice(0, 10)
        });
    }

    const minAmountOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const swapParams = quote.kind === 'cl'
        ? ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
            [[
                [
                    quote.poolKey.currency0,
                    quote.poolKey.currency1,
                    quote.poolKey.hooks,
                    quote.poolKey.poolManager,
                    quote.poolKey.fee,
                    quote.poolKey.parameters
                ],
                quote.zeroForOne,
                amountInWei,
                minAmountOut,
                '0x'
            ]]
        )
        : ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
            [[
                [
                    quote.poolKey.currency0,
                    quote.poolKey.currency1,
                    quote.poolKey.hooks,
                    quote.poolKey.poolManager,
                    quote.poolKey.fee,
                    quote.poolKey.parameters
                ],
                quote.zeroForOne,
                amountInWei,
                minAmountOut,
                '0x'
            ]]
        );

    const actions: number[] = [];
    const paramsArray: string[] = [];

    actions.push(
        quote.kind === 'cl'
            ? INFINITY_ACTIONS.CL_SWAP_EXACT_IN_SINGLE
            : INFINITY_ACTIONS.BIN_SWAP_EXACT_IN_SINGLE
    );
    paramsArray.push(swapParams);

    // finalizeSwap with MSG_SENDER (SETTLE_ALL + TAKE_ALL)
    actions.push(INFINITY_ACTIONS.SETTLE_ALL);
    paramsArray.push(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [normalizedIn, MAX_UINT256]
        )
    );
    actions.push(INFINITY_ACTIONS.TAKE_ALL);
    paramsArray.push(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [normalizedOut, 0]
        )
    );

    const actionsBytes = ethers.hexlify(Uint8Array.from(actions));
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes[]'], [actionsBytes, paramsArray]);

    let commands = ethers.solidityPacked(['uint8'], [INFINITY_COMMANDS.INFI_SWAP]);
    let inputs = [payload];

    if (isNativeIn) {
        const wrapParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [PANCAKE_INFINITY_ROUTER, INFINITY_ACTION_CONSTANTS.CONTRACT_BALANCE]
        );
        commands = ethers.solidityPacked(['uint8', 'bytes'], [INFINITY_COMMANDS.WRAP_ETH, commands]);
        inputs = [wrapParams, ...inputs];
    }

    const data = infinityRouterInterface.encodeFunctionData('execute', [commands, inputs, deadline]);

    const executionMode: DirectSwapExecutionMode = options?.executionMode === 'turbo' ? 'turbo' : 'balanced';

    try {
        await callRpc<string>(chainId, 'eth_call', [{
            from: walletAddress,
            to: PANCAKE_INFINITY_ROUTER,
            data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }, 'latest']);
    } catch (err: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Infinity pre-simulation failed', {
            error: err?.message?.slice(0, 160)
        });
        if (executionMode !== 'turbo') {
            return { success: false, error: 'Infinity pre-simulation failed', provider: 'failed' };
        }
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Infinity pre-simulation soft-fail in turbo mode', {
            error: err?.message?.slice(0, 160)
        });
    }

    let gasLimit: string;
    try {
        const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
            from: walletAddress,
            to: PANCAKE_INFINITY_ROUTER,
            data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }]);
        gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
        gasLimit = '900000';
    }

    const txHash = await sendTransaction(userId, accessToken, {
        to: PANCAKE_INFINITY_ROUTER,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        executionProfile: getTxExecutionProfile(chainId),
        gas: gasLimit
    });

    return {
        success: true,
        txHash,
        provider: 'pancake-infinity',
        poolInfo: {
            version: quote.kind === 'cl' ? 'infinity-cl' : 'infinity-bin',
            fee: quote.fee,
            liquidity: '0'
        }
    };
}

/**
 * 执行 V3 交易
 */
async function executeV3Swap(
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
    pool: PoolInfo,
    dex: 'uniswap' | 'pancake',
    options?: { fastMode?: boolean; executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, chainId, slippageBps } = params;

    // V3 SwapRouter02 地址
    const SWAP_ROUTER_02: Record<number, string> = {
        8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
        1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',    // Ethereum
        56: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'    // Uniswap V3 SwapRouter02 on BSC
    };

    const routerAddress = dex === 'pancake' ? PANCAKE_V3_ROUTER : SWAP_ROUTER_02[chainId];
    if (!routerAddress) {
        return { success: false, error: 'V3 router not available', provider: 'failed' };
    }

    // 计算金额
    const amountInWei = params.amountInWei;

    // [Logic]: ETH 地址转换为 WETH，因为 V3 Router 需要 WETH 地址
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()
        ? WETH_ADDRESSES[chainId]
        : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()
        ? WETH_ADDRESSES[chainId]
        : tokenOut;

    // [Logic]: 优先使用 V3 QuoterV2 获取链上报价，0x 作为备用
    let quoterOut = 0n;
    let bestFee = pool.fee || 3000;
    const quoterAddress = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    if (quoterAddress && !options?.fastMode) {
        try {
            for (const fee of feeTiers) {
                try {
                    const quoteParams = {
                        tokenIn: normalizedIn,
                        tokenOut: normalizedOut,
                        amountIn: amountInWei,
                        fee: fee,
                        sqrtPriceLimitX96: 0
                    };
                    const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
                    const result = await callRpc<string>(chainId, 'eth_call', [{
                        to: quoterAddress,
                        data: callData
                    }, 'latest']);
                    if (!result || result === '0x') continue;
                    const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
                    const amountOut = decoded[0] as bigint;
                    if (amountOut > quoterOut) {
                        quoterOut = amountOut;
                        bestFee = fee;
                    }
                } catch {
                    continue;
                }
            }
        } catch (err: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V3 quoter failed', {
                error: err?.message?.slice(0, 120)
            });
        }
    }

    // 0x Price API 备用（fastMode 跳过以减少 copytrade 延迟）
    const expectedOut0x = options?.fastMode
        ? 0n
        : await get0xExpectedOutput(normalizedIn!, normalizedOut!, amountInWei, chainId);

    // 偏离检测：0x 报价高于 quoter 太多则拒绝
    const MAX_V3_QUOTE_DEVIATION_BPS = 2000; // 20%
    if (quoterOut > 0n && expectedOut0x > 0n) {
        const maxAllowed = quoterOut * BigInt(10000 + MAX_V3_QUOTE_DEVIATION_BPS) / BigInt(10000);
        if (expectedOut0x > maxAllowed) {
            logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x quote deviates from quoter; using quoter', {
                quoterOut: quoterOut.toString().slice(0, 15),
                expectedOut0x: expectedOut0x.toString().slice(0, 15)
            });
        }
    }

    // 选择更保守的报价用于 minOut
    let baseOut = 0n;
    if (quoterOut > 0n && expectedOut0x > 0n) {
        baseOut = quoterOut < expectedOut0x ? quoterOut : expectedOut0x;
    } else {
        baseOut = quoterOut > 0n ? quoterOut : expectedOut0x;
    }

    const minAmountOut = baseOut > 0n
        ? baseOut * BigInt(10000 - slippageBps) / BigInt(10000)
        : BigInt(0); // [Risk]: 无价格时无滑点保护

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V3 minAmountOut calculated', {
        expectedOut: expectedOut0x.toString().slice(0, 15),
        quoterOut: quoterOut.toString().slice(0, 15),
        bestFee,
        minAmountOut: minAmountOut.toString().slice(0, 15),
        slippageBps
    });

    // 构建 exactInputSingle 调用
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const routerInterface = new ethers.Interface(
        dex === 'pancake'
            ? [
                'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
            ]
            : [
                'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
            ]
    );

    const swapParams = dex === 'pancake'
        ? {
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            fee: bestFee,
            recipient: walletAddress,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        }
        : {
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            fee: bestFee,
            recipient: walletAddress,
            amountIn: amountInWei,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        };

    const data = routerInterface.encodeFunctionData('exactInputSingle', [swapParams]);

    // 发送交易
    // [Logic]: 只有原始输入是 ETH（0xeeee...）时才发送 value，WETH 不需要发送 value
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();

    let gasLimit = '450000';
    if (options?.fastMode) {
        gasLimit = DIRECT_SWAP_TURBO_V3_GAS_LIMIT;
    } else {
        try {
            const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
                from: walletAddress,
                to: routerAddress,
                data,
                value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
            }]);
            gasLimit = (BigInt(estimate) * 2n).toString();
        } catch {
            gasLimit = '450000';
        }
    }

    const txHash = await sendTransaction(userId, accessToken, {
        to: routerAddress,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        executionProfile: getTxExecutionProfile(chainId),
        gas: gasLimit
    });

    logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V3 swap executed', {
        txHash,
        pool: pool.poolAddress.slice(0, 20)
    });

    return {
        success: true,
        txHash,
        provider: dex === 'pancake' ? 'pancake-v3' : 'uniswap-v3',
        poolInfo: {
            version: 'v3',
            fee: pool.fee || 3000,
            liquidity: pool.liquidity || '0'
        }
    };
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
    // 目前支持 Base、Ethereum、BSC
    return chainId === 8453 || chainId === 1 || chainId === 56;
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
