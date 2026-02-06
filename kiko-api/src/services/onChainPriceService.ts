/**
 * On-Chain Price Service (RPC Fallback)
 * Fetches price, liquidity, and market cap directly from chain via RPC
 * Used when DexScreener/GeckoTerminal APIs fail
 */

import { callRpc, getErc20Decimals } from './rpcManager.js';
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';
import { getChainConfig } from '../config/chainConfig.js';
import { TOKEN_REGISTRY, getTokenDecimalsFromRegistry, NATIVE_TOKEN_ADDRESS } from '../config/tokenRegistry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { ethers } from 'ethers';
import { calculatePriceFromSqrtX96, findV4Pools, V4_STATE_VIEW } from './dex/uniswapV4.js';
import { get as getDbCache, set as setDbCache } from '../cache/dbCache.js';

// Uniswap V2 Factory ABI (minimal)
const FACTORY_V2_ABI = parseAbi([
    'function getPair(address tokenA, address tokenB) view returns (address pair)'
]);

// Uniswap V3 Factory ABI (minimal)
const FACTORY_V3_ABI = parseAbi([
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
]);

// Uniswap V2 Pair ABI (minimal)
const PAIR_V2_ABI = parseAbi([
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function totalSupply() view returns (uint256)'
]);

// ⚡ V2 Router ABI - For getAmountsOut price quotes (SushiSwap, PancakeSwap V2, etc.)
const ROUTER_V2_ABI = parseAbi([
    'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
]);

// V2 Router ethers interface for encoding
const routerV2Interface = new ethers.Interface([
    'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
]);

// ⚡ Aerodrome/Velodrome Router ABI - Uses Route struct instead of address array
// Route struct: { from: address, to: address, stable: bool, factory: address }
const AERODROME_ROUTER_ABI = [
    'function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)'
];

// Aerodrome Router ethers interface
const aerodromeRouterInterface = new ethers.Interface(AERODROME_ROUTER_ABI);

// Aerodrome Pool Factory address (for Route struct)
const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

type QuoteToken = {
    address: string;
    symbol: string;
    decimals: number;
    usdPrice: number; // 1 for stablecoins, native price for wrapped native
    isStable: boolean;
};

// ⚡ DEX Router addresses by chain - For direct getAmountsOut price quotes
// Priority order: Most likely to have liquidity first
// type: 'aerodrome' = uses Route struct, 'v2' = uses address[] path
const DEX_ROUTERS: Record<number, { name: string; address: string; type: 'v2' | 'v3' | 'aerodrome' }[]> = {
    8453: [ // Base - Aerodrome is the largest DEX!
        { name: 'Aerodrome', address: '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', type: 'aerodrome' },
        { name: 'SushiSwap', address: '0x804b526e5bf4349819fe2db65349d0825870f8ee', type: 'v2' },
    ],
    1: [ // Ethereum
        { name: 'SushiSwap', address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', type: 'v2' },
    ],
    42161: [ // Arbitrum
        { name: 'Camelot', address: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d', type: 'v2' },
        { name: 'SushiSwap', address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', type: 'v2' },
    ],
    56: [ // BSC
        { name: 'PancakeSwap V2', address: '0x10ED43C718714eb63d5aA57B78B54704E256024E', type: 'v2' },
    ],
    137: [ // Polygon
        { name: 'QuickSwap', address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', type: 'v2' },
        { name: 'SushiSwap', address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', type: 'v2' },
    ],
};

// Uniswap V3 Pool ABI (minimal)
const POOL_V3_ABI = parseAbi([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function liquidity() view returns (uint128)',
    'function fee() view returns (uint24)'
]);

// ERC20 ABI (minimal)
const ERC20_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
]);

// Multicall3 deployed at same address on all EVM chains
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Ethers interfaces for Multicall3
const multicall3Interface = new ethers.Interface([
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
]);

const factoryV3Interface = new ethers.Interface([
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
]);

const poolV3Interface = new ethers.Interface([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)'
]);

const erc20Interface = new ethers.Interface([
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
]);

// ⚡ QuoterV2 - Single RPC call for price quote!
const quoterV2Interface = new ethers.Interface([
    'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

// QuoterV2 addresses per chain (V3)
const QUOTER_V2_ADDRESSES: Record<number, string> = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',     // Ethereum
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',  // Base
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Arbitrum
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',    // Optimism
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',   // Polygon
    56: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',   // BSC (PancakeSwap V3 Quoter)
};

// ⚡ Uniswap V4 Quoter - Latest version with Hooks support!
// [Ref]: https://docs.uniswap.org/contracts/v4/overview
const quoterV4Interface = new ethers.Interface([
    // QuoteExactInputSingleParams: { poolKey, zeroForOne, exactAmount, hookData }
    // PoolKey: { currency0, currency1, fee, tickSpacing, hooks }
    'function quoteExactInputSingle((' +
    '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey,' +
    'bool zeroForOne,' +
    'uint128 exactAmount,' +
    'bytes hookData' +
    ') params) external returns (uint256 amountOut, uint256 gasEstimate)'
]);

// V4 Quoter addresses per chain (deployed 2025-01-30)
const QUOTER_V4_ADDRESSES: Record<number, string> = {
    1: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',     // Ethereum
    8453: '0x0d5e0f971ed27fbff6c2837bf31316121532048d',  // Base
};

const V4_POOL_MANAGER_ADDRESSES: Record<number, string> = {
    1: '0x000000000004444c5dc75cB358380D2e3dE08A90', // Ethereum
    8453: '0x498581ff718922c3f8e6a244956af099b2652b2b', // Base
};

const V4_INIT_EVENT = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const V4_PAIR_CACHE_TTL_MS = 5 * 60 * 1000;
const v4PairCache = new Map<string, { pools: Array<{ poolId: string; token0: string; token1: string }>; timestamp: number }>();
const V4_INIT_FROM_BLOCKS: Record<number, string> = {
    1: '0x14af009',  // Ethereum v4 PoolManager deployment block (21688329)
    8453: '0x27b6a9f', // Base v4 PoolManager deployment block (41642655)
};

// Common V4 fee tiers and tick spacings
const V4_POOL_CONFIGS = [
    { fee: 500, tickSpacing: 10 },    // 0.05%
    { fee: 3000, tickSpacing: 60 },   // 0.3%
    { fee: 10000, tickSpacing: 200 }, // 1%
];

// ⚡ PRICE CACHE: Sub-10ms reads for repeated queries
interface PriceCache {
    price: number;
    marketCap: number;
    timestamp: number;
    dexName: string;
}
const priceCache = new Map<string, PriceCache>();
const PRICE_CACHE_TTL = 5000; // 5 second cache

type RpcStrategy = 'fast' | 'cheap';
const FAST_RPC_RACE = Number(process.env.FAST_RPC_RACE || 2);

async function callRpcWithStrategy<T = any>(
    chainId: number,
    method: string,
    params: any[],
    rpcStrategy: RpcStrategy
): Promise<T> {
    if (rpcStrategy === 'fast' && FAST_RPC_RACE > 1) {
        const candidates = ['fast', 'cheap'];
        const attempts = candidates.slice(0, FAST_RPC_RACE).map((strategy) =>
            callRpc<T>(chainId, method, params, { strategy: strategy as 'fast' | 'cheap' })
        );
        return await Promise.any(attempts);
    }
    return callRpc<T>(chainId, method, params, { strategy: rpcStrategy });
}

function normalizeCurrency(address: string): string {
    const lower = address.toLowerCase();
    return lower === ZERO_ADDRESS ? NATIVE_PLACEHOLDER : lower;
}

function isNativeEquivalent(address: string, wrappedNative: string): boolean {
    const lower = address.toLowerCase();
    return lower === NATIVE_PLACEHOLDER || lower === wrappedNative.toLowerCase();
}

function getV4PoolManager(chainId: number): string | null {
    const envKey = `V4_POOL_MANAGER_${chainId}`;
    const envVal = (process.env as Record<string, string | undefined>)[envKey];
    return envVal || V4_POOL_MANAGER_ADDRESSES[chainId] || null;
}

// NOTE: V4 pool discovery now uses official PoolId computation in uniswapV4.ts

// Known DEX Factory addresses by chain (2026 Official Deployments)
const DEX_FACTORIES: Record<number, { name: string; address: string; version: string }[]> = {
    1: [ // Ethereum
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Sushiswap', address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', version: 'v2' }
    ],
    8453: [ // Base (2026 Official)
        { name: 'Aerodrome', address: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', version: 'v2' }, // Aerodrome main DEX on Base (highest liquidity)
        { name: 'Uniswap V3', address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', version: 'v3' }, // Clanker/Zora tokens
        { name: 'BaseSwap', address: '0xFDa619b6d20975be80A10332dD6a09952FB6EFA0', version: 'v2' }
    ],
    56: [ // BSC (2026 Official)
        { name: 'FourMeme', address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b', version: 'bonding' }, // FourMeme launchpad
        { name: 'Uniswap V3', address: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7', version: 'v3' },
        { name: 'PancakeSwap V3', address: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', version: 'v3' },
        { name: 'PancakeSwap V2', address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', version: 'v2' },
        { name: 'BiSwap', address: '0x858E3312ed3A876947EA49d572A7C42DE08af7EE', version: 'v2' }
    ],
    42161: [ // Arbitrum
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Sushiswap', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', version: 'v2' }
    ],
    10: [ // Optimism
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' }
    ],
    137: [ // Polygon
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Quickswap', address: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', version: 'v2' },
        { name: 'Sushiswap', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', version: 'v2' }
    ]
};

export interface OnChainPriceData {
    price: number;
    marketCap: number;
    pairAddress: string;
    dexName: string;
}

function buildStableQuoteTokens(chainId: number): QuoteToken[] {
    const quotes: QuoteToken[] = [];
    const usdc = TOKEN_REGISTRY.USDC?.addresses[chainId];
    if (usdc) {
        quotes.push({
            address: usdc,
            symbol: 'USDC',
            decimals: getTokenDecimalsFromRegistry(usdc, chainId) || 6,
            usdPrice: 1,
            isStable: true
        });
    }
    const usdt = TOKEN_REGISTRY.USDT?.addresses[chainId];
    if (usdt) {
        quotes.push({
            address: usdt,
            symbol: 'USDT',
            decimals: getTokenDecimalsFromRegistry(usdt, chainId) || 6,
            usdPrice: 1,
            isStable: true
        });
    }
    return quotes;
}

async function buildNativeQuoteToken(chainId: number): Promise<QuoteToken | null> {
    const chainConfig = getChainConfig(chainId);
    const wrappedNative = chainConfig.wrappedNativeAddress;
    const nativePrice = await getNativeTokenPriceUsd(chainId);
    if (!nativePrice || nativePrice <= 0) return null;
    return {
        address: wrappedNative,
        symbol: chainConfig.nativeCurrency.symbol || 'NATIVE',
        decimals: 18,
        usdPrice: nativePrice,
        isStable: false
    };
}

/**
 * Fetch token price and liquidity directly from chain
 * Falls back to multiple DEXes if first fails
 * ⚡ OPTIMIZED: Cache + Multicall for sub-100ms queries
 */
export async function getOnChainPrice(
    tokenAddress: string,
    chainId: number,
    options: { rpcStrategy?: 'fast' | 'cheap' } = {}
): Promise<OnChainPriceData | null> {
    const rpcStrategy = options.rpcStrategy || 'cheap';
    const chainConfig = getChainConfig(chainId);
    const wrappedNative = chainConfig.wrappedNativeAddress;
    const tokenLower = tokenAddress.toLowerCase();

    // Native/Wrapped native fast-path
    if (tokenLower === NATIVE_PLACEHOLDER || tokenLower === wrappedNative.toLowerCase()) {
        const nativePriceUsd = await getNativeTokenPriceUsd(chainId);
        if (nativePriceUsd && nativePriceUsd > 0) {
            return {
                price: nativePriceUsd,
                marketCap: 0,
                pairAddress: '',
                dexName: 'Native Price Cache'
            };
        }
    }

    // ⚡ CACHE CHECK: Return instantly if cached (<1ms)
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return {
            price: cached.price,
            marketCap: cached.marketCap,
            pairAddress: '',
            dexName: `${cached.dexName} (cached)`
        };
    }

    const factories = DEX_FACTORIES[chainId] || [];
    const routers = DEX_ROUTERS[chainId] || [];

    if (factories.length === 0 && routers.length === 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'No DEX factories/routers configured for chain', { chainId });
        return null;
    }

    const stableQuotes = buildStableQuoteTokens(chainId);
    const quoteAttempts: QuoteToken[] = [...stableQuotes];
    const nativeQuote = await buildNativeQuoteToken(chainId);
    if (nativeQuote) quoteAttempts.push(nativeQuote);

    for (const quote of quoteAttempts) {
        if (quote.address.toLowerCase() === tokenLower) continue;

        // ⚡ V4 QUOTER: Try Uniswap V4 quoter first (fast, no log scan)
        if (QUOTER_V4_ADDRESSES[chainId]) {
            try {
                const v4Result = await fetchPriceFromUniswapV4(tokenAddress, quote, chainId, rpcStrategy);
                if (v4Result && v4Result.price > 0) {
                    priceCache.set(cacheKey, {
                        price: v4Result.price,
                        marketCap: v4Result.marketCap,
                        timestamp: Date.now(),
                        dexName: v4Result.dexName
                    });
                    return v4Result;
                }
            } catch {
                // V4 failed, continue to poolId + v3/v2
            }
        }

        // ⚡ V4 poolId-based fallback (supports hooks; slower due to logs)
        if (V4_STATE_VIEW[chainId]) {
            try {
                const v4PoolResult = await fetchPriceFromUniswapV4PoolId(tokenAddress, quote, chainId, rpcStrategy);
                if (v4PoolResult && v4PoolResult.price > 0) {
                    priceCache.set(cacheKey, {
                        price: v4PoolResult.price,
                        marketCap: v4PoolResult.marketCap,
                        timestamp: Date.now(),
                        dexName: v4PoolResult.dexName
                    });
                    return v4PoolResult;
                }
            } catch {
                // Continue to v3/v2
            }
        }

        // Try each DEX factory until one succeeds
        const fetchPromises = factories.map(async (factory) => {
            try {
                let priceData: OnChainPriceData | null = null;

                if (factory.version === 'v3') {
                    priceData = await fetchPriceFromUniswapV3(
                        tokenAddress,
                        quote,
                        factory.address,
                        factory.name,
                        chainId,
                        rpcStrategy
                    );
                } else if (factory.version === 'bonding') {
                    priceData = await fetchPriceFromBondingCurve(
                        tokenAddress,
                        factory.address,
                        factory.name,
                        chainId,
                        rpcStrategy
                    );
                } else {
                    priceData = await fetchPriceFromDex(
                        tokenAddress,
                        quote,
                        factory.address,
                        factory.name,
                        chainId,
                        rpcStrategy
                    );
                }

                if (priceData && priceData.price > 0) {
                    return { success: true, data: priceData, factory: factory.name };
                }
                return { success: false, data: null, factory: factory.name };
            } catch (err: any) {
                return { success: false, data: null, factory: factory.name, error: err.message };
            }
        });

        const results = await Promise.allSettled(fetchPromises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success && result.value.data) {
                const data = result.value.data;
                priceCache.set(cacheKey, {
                    price: data.price,
                    marketCap: data.marketCap,
                    timestamp: Date.now(),
                    dexName: result.value.factory
                });
                logger.info(LogCode.API_FETCH_SUCCESS, `On-chain price fetched from ${result.value.factory}`, {
                    token: tokenAddress,
                    price: data.price,
                    marketCap: data.marketCap,
                    quote: quote.symbol
                });
                return data;
            }
        }

        // ⚡ FALLBACK: Try Router getAmountsOut
        for (const router of routers) {
            try {
                let routerData: OnChainPriceData | null = null;

                if (router.type === 'aerodrome') {
                    routerData = await fetchPriceFromAerodrome(
                        tokenAddress,
                        quote,
                        router.address,
                        chainId,
                        rpcStrategy
                    );
                } else if (router.type === 'v2') {
                    routerData = await fetchPriceFromV2Router(
                        tokenAddress,
                        quote,
                        router.address,
                        router.name,
                        chainId,
                        rpcStrategy
                    );
                }

                if (routerData && routerData.price > 0) {
                    priceCache.set(cacheKey, {
                        price: routerData.price,
                        marketCap: routerData.marketCap,
                        timestamp: Date.now(),
                        dexName: router.name
                    });
                    logger.info(LogCode.API_FETCH_SUCCESS, `🔗 Router fallback succeeded: ${router.name}`, {
                        token: tokenAddress,
                        price: routerData.price,
                        quote: quote.symbol
                    });
                    return routerData;
                }
            } catch (err: any) {
                logger.debug(LogCode.API_FETCH_FAILED, `Router ${router.name} failed`, { error: err.message });
            }
        }
    }

    logger.warn(LogCode.API_FETCH_FAILED, 'All on-chain DEX queries failed (Factory + Router)', { token: tokenAddress, chainId });
    return null;
}

/**
 * Fetch price from a specific DEX factory
 * Note: Only fetches price and market cap. Liquidity is unreliable on-chain and should come from APIs.
 */
async function fetchPriceFromDex(
    tokenAddress: string,
    quote: QuoteToken,
    factoryAddress: string,
    dexName: string,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    // Step 1: Get pair address from factory
    const pairAddress = await callEthCall<string>(
        chainId,
        factoryAddress,
        FACTORY_V2_ABI,
        'getPair',
        [tokenAddress, quote.address],
        rpcStrategy
    );

    // Check if pair exists
    if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
        return null; // No pair found
    }

    // Step 2: Get reserves from pair
    const [reserve0, reserve1] = await callEthCall<[bigint, bigint, number]>(
        chainId,
        pairAddress,
        PAIR_V2_ABI,
        'getReserves',
        [],
        rpcStrategy
    );

    // Step 3: Determine which reserve is token vs quote
    const token0 = await callEthCall<string>(
        chainId,
        pairAddress,
        PAIR_V2_ABI,
        'token0',
        [],
        rpcStrategy
    );

    const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
    const tokenReserve = isToken0 ? reserve0 : reserve1;
    const quoteReserve = isToken0 ? reserve1 : reserve0;

    // Step 4: Get decimals
    const tokenDecimals = await callEthCall<number>(
        chainId,
        tokenAddress,
        ERC20_ABI,
        'decimals',
        [],
        rpcStrategy
    );

    const quoteDecimals = quote.decimals;

    // Step 5: Calculate price (native per token)
    const tokenReserveFloat = Number(tokenReserve) / Math.pow(10, tokenDecimals);
    const quoteReserveFloat = Number(quoteReserve) / Math.pow(10, quoteDecimals);

    if (tokenReserveFloat === 0) {
        return null; // No liquidity
    }

    const priceInQuote = quoteReserveFloat / tokenReserveFloat;
    const priceUsd = priceInQuote * quote.usdPrice;

    // Step 7: Estimate market cap (total supply × price)
    let marketCap = 0;
    try {
        const totalSupply = await callEthCall<bigint>(
            chainId,
            tokenAddress,
            ERC20_ABI,
            'totalSupply',
            [],
            rpcStrategy
        );
        const totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
        marketCap = totalSupplyFloat * priceUsd;
    } catch {
        marketCap = 0; // Cannot estimate without total supply
    }

    return {
        price: priceUsd,
        marketCap: marketCap,
        pairAddress: pairAddress,
        dexName: dexName
    };
}

/**
 * ⚡ Fetch price from V2 Router using getAmountsOut
 * More reliable than Factory+Pair method for Aerodrome, SushiSwap, etc.
 * [Ref]: V2 Router uses x*y=k formula, getAmountsOut calculates output amount
 */
async function fetchPriceFromV2Router(
    tokenAddress: string,
    quote: QuoteToken,
    routerAddress: string,
    dexName: string,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    try {
        // [Logic]: Query how much token we get for quote token
        const amountIn = ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);
        const path = [quote.address, tokenAddress];

        // Encode getAmountsOut call
        const callData = routerV2Interface.encodeFunctionData('getAmountsOut', [amountIn, path]);

        // Make RPC call (same pattern as callEthCall)
        const result = await callRpcWithStrategy<string>(chainId, 'eth_call', [{
            to: routerAddress,
            data: callData
        }, 'latest'], rpcStrategy);

        if (!result || result === '0x') {
            return null; // No pool or error
        }

        // Decode result
        const decoded = routerV2Interface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded[0] as bigint[];

        if (amounts.length < 2 || amounts[1] === 0n) {
            return null; // Invalid result
        }

        // Get token decimals
        const tokenDecimals = await callEthCall<number>(
            chainId,
            tokenAddress,
            ERC20_ABI,
            'decimals',
            [],
            rpcStrategy
        );

        const tokenAmountOut = Number(amounts[1]) / Math.pow(10, tokenDecimals);
        const quoteAmountIn = quote.isStable ? 10 : 0.01;
        const priceInQuote = quoteAmountIn / tokenAmountOut;
        const priceUsd = priceInQuote * quote.usdPrice;

        // Get market cap
        let marketCap = 0;
        try {
            const totalSupply = await callEthCall<bigint>(
                chainId,
                tokenAddress,
                ERC20_ABI,
                'totalSupply',
                [],
                rpcStrategy
            );
            const totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
            marketCap = totalSupplyFloat * priceUsd;
        } catch {
            // [Risk]: totalSupply may fail for some tokens
            marketCap = 0;
        }

        logger.info(LogCode.API_FETCH_SUCCESS, `🔗 ${dexName} Router price fetched`, {
            token: tokenAddress,
            price: priceUsd.toFixed(12),
            dex: dexName
        });

        return {
            price: priceUsd,
            marketCap: marketCap,
            pairAddress: routerAddress, // Use router as reference
            dexName: dexName
        };
    } catch (err: any) {
        // [Risk]: Call may fail if no liquidity pool exists
        logger.debug(LogCode.API_FETCH_FAILED, `${dexName} Router query failed`, {
            token: tokenAddress,
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * ⚡ Fetch price from Aerodrome Router using Route struct
 * Aerodrome uses a different signature: getAmountsOut(amountIn, Route[] routes)
 * Route = { from, to, stable, factory }
 * [Ref]: https://github.com/aerodrome-finance/contracts - Router.sol
 */
async function fetchPriceFromAerodrome(
    tokenAddress: string,
    quote: QuoteToken,
    routerAddress: string,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    try {
        // [Logic]: Try both stable=false (volatile) and stable=true pools
        const amountIn = ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);
        const amountInFloat = quote.isStable ? 10 : 0.01;

        // Route struct: { from, to, stable, factory }
        // Try volatile pool first (most meme coins are volatile)
        const routes = [{
            from: quote.address,
            to: tokenAddress,
            stable: false,
            factory: AERODROME_FACTORY
        }];

        // Encode getAmountsOut call with Route[] struct
        const callData = aerodromeRouterInterface.encodeFunctionData('getAmountsOut', [amountIn, routes]);

        // Make RPC call
        const result = await callRpcWithStrategy<string>(chainId, 'eth_call', [{
            to: routerAddress,
            data: callData
        }, 'latest'], rpcStrategy);

        if (!result || result === '0x') {
            // Try stable pool as fallback
            routes[0].stable = true;
            const stableCallData = aerodromeRouterInterface.encodeFunctionData('getAmountsOut', [amountIn, routes]);
            const stableResult = await callRpcWithStrategy<string>(chainId, 'eth_call', [{
                to: routerAddress,
                data: stableCallData
            }, 'latest'], rpcStrategy);

            if (!stableResult || stableResult === '0x') {
                return null;
            }

            // Decode stable result
            const decoded = aerodromeRouterInterface.decodeFunctionResult('getAmountsOut', stableResult);
            return await calculatePriceFromAmounts(decoded, tokenAddress, chainId, 'Aerodrome (stable)', rpcStrategy, quote, amountInFloat);
        }

        // Decode volatile result
        const decoded = aerodromeRouterInterface.decodeFunctionResult('getAmountsOut', result);
        return await calculatePriceFromAmounts(decoded, tokenAddress, chainId, 'Aerodrome', rpcStrategy, quote, amountInFloat);

    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Aerodrome Router query failed', {
            token: tokenAddress,
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Helper: Calculate price from getAmountsOut result
 */
async function calculatePriceFromAmounts(
    decoded: any,
    tokenAddress: string,
    chainId: number,
    dexName: string,
    rpcStrategy: RpcStrategy,
    quote: QuoteToken,
    quoteAmountIn: number
): Promise<OnChainPriceData | null> {
    const amounts = decoded[0] as bigint[];

    if (amounts.length < 2 || amounts[1] === 0n) {
        return null;
    }

    // Get token decimals
    const tokenDecimals = await callEthCall<number>(
        chainId,
        tokenAddress,
        ERC20_ABI,
        'decimals',
        [],
        rpcStrategy
    );

    // Calculate price
    const tokenAmountOut = Number(amounts[1]) / Math.pow(10, tokenDecimals);
    const priceInQuote = quoteAmountIn / tokenAmountOut;
    const priceUsd = priceInQuote * quote.usdPrice;

    // Get market cap
    let marketCap = 0;
    try {
        const totalSupply = await callEthCall<bigint>(
            chainId,
            tokenAddress,
            ERC20_ABI,
            'totalSupply',
            [],
            rpcStrategy
        );
        const totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
        marketCap = totalSupplyFloat * priceUsd;
    } catch {
        marketCap = 0;
    }

    logger.info(LogCode.API_FETCH_SUCCESS, `🔗 ${dexName} price fetched`, {
        token: tokenAddress,
        price: priceUsd.toFixed(12)
    });

    return {
        price: priceUsd,
        marketCap: marketCap,
        pairAddress: '',
        dexName: dexName
    };
}

/**
 * Get native token price in USD (ETH, BNB, SOL, etc.)
 * ⚡ OPTIMIZED: 10-minute cache + background refresh using Coinbase API (stable, no rate limit)
 */
let nativePriceCache: { [chainId: number]: { price: number; timestamp: number } } = {};
const NATIVE_PRICE_CACHE_TTL = 600000; // 10 minutes cache

// Native token symbols for Coinbase API
const NATIVE_COINBASE_SYMBOLS: Record<number, string> = {
    1: 'ETH',       // Ethereum
    8453: 'ETH',    // Base uses ETH
    56: 'BNB',      // BSC
    42161: 'ETH',   // Arbitrum uses ETH
    10: 'ETH',      // Optimism uses ETH
    137: 'MATIC',   // Polygon
    900: 'SOL',     // Solana ✅ NEW
};

// Fallback prices (updated 2026-02)
const NATIVE_PRICE_ESTIMATES: Record<number, number> = {
    1: 2450,    // ETH ~$2450
    8453: 2450, // Base (ETH)
    56: 780,    // BNB ~$780
    42161: 2450, // Arbitrum (ETH)
    10: 2450,   // Optimism (ETH)
    137: 0.11,  // MATIC ~$0.11
    900: 105,   // SOL ~$105 ✅ NEW
};

/**
 * ⚡ PRELOAD: Fetch all native token prices at startup using Coinbase API
 * Call this when the server starts to warm the cache
 */
export async function preloadNativeTokenPrices(): Promise<void> {
    logger.info(LogCode.API_FETCH_SUCCESS, '⚡ Preloading native token prices via Coinbase...');

    const chainIds = Object.keys(NATIVE_COINBASE_SYMBOLS).map(Number);
    const uniqueSymbols = [...new Set(Object.values(NATIVE_COINBASE_SYMBOLS))];

    try {
        // Fetch all unique symbols in parallel from Coinbase API
        const priceResults = await Promise.allSettled(
            uniqueSymbols.map(async (symbol) => {
                const response = await fetch(
                    `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return { symbol, price: parseFloat(data.data.amount) };
            })
        );

        // Build symbol -> price map
        const priceMap: Record<string, number> = {};
        for (const result of priceResults) {
            if (result.status === 'fulfilled' && result.value.price > 0) {
                priceMap[result.value.symbol] = result.value.price;
            }
        }

        // Cache prices for all chains
        const now = Date.now();
        for (const chainId of chainIds) {
            const symbol = NATIVE_COINBASE_SYMBOLS[chainId];
            const price = priceMap[symbol];
            if (price && price > 0) {
                nativePriceCache[chainId] = { price, timestamp: now };
            } else {
                // Use fallback if Coinbase failed
                nativePriceCache[chainId] = { price: NATIVE_PRICE_ESTIMATES[chainId] || 2450, timestamp: now };
            }
        }

        logger.info(LogCode.API_FETCH_SUCCESS, '⚡ Native token prices cached (Coinbase)', {
            eth: priceMap['ETH'],
            bnb: priceMap['BNB'],
            sol: priceMap['SOL'],
            chains: chainIds.length
        });
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to preload native prices, using fallbacks', { error: error.message });

        // Use fallback prices
        const now = Date.now();
        for (const chainId of chainIds) {
            nativePriceCache[chainId] = {
                price: NATIVE_PRICE_ESTIMATES[chainId] || 2450,
                timestamp: now
            };
        }
    }
}

/**
 * Start background refresh (call once at startup)
 */
export function startNativePriceRefresh(): void {
    // Preload immediately
    preloadNativeTokenPrices();

    // Refresh every 10 minutes
    setInterval(() => {
        preloadNativeTokenPrices();
    }, NATIVE_PRICE_CACHE_TTL);

    logger.info(LogCode.API_FETCH_SUCCESS, '⚡ Native price refresh started (10 min interval)');
}

export async function getNativeTokenPriceUsd(chainId: number): Promise<number> {
    // Check memory cache first (should always hit after preload)
    const cached = nativePriceCache[chainId];
    if (cached && Date.now() - cached.timestamp < NATIVE_PRICE_CACHE_TTL) {
        return cached.price;
    }

    // ⚡ RPC-first: derive native price from on-chain stable pairs (USDC/USDT)
    try {
        const chainConfig = getChainConfig(chainId);
        const wrappedNative = chainConfig.wrappedNativeAddress;
        const stableQuotes = buildStableQuoteTokens(chainId);
        const factories = DEX_FACTORIES[chainId] || [];
        const routers = DEX_ROUTERS[chainId] || [];

        for (const quote of stableQuotes) {
            if (quote.address.toLowerCase() === wrappedNative.toLowerCase()) continue;

            if (QUOTER_V4_ADDRESSES[chainId]) {
                const v4Result = await fetchPriceFromUniswapV4(wrappedNative, quote, chainId, 'fast');
                if (v4Result?.price) {
                    nativePriceCache[chainId] = { price: v4Result.price, timestamp: Date.now() };
                    return v4Result.price;
                }
            }

            if (V4_STATE_VIEW[chainId]) {
                const v4PoolResult = await fetchPriceFromUniswapV4PoolId(wrappedNative, quote, chainId, 'fast');
                if (v4PoolResult?.price) {
                    nativePriceCache[chainId] = { price: v4PoolResult.price, timestamp: Date.now() };
                    return v4PoolResult.price;
                }
            }

            for (const factory of factories) {
                let priceData: OnChainPriceData | null = null;
                if (factory.version === 'v3') {
                    priceData = await fetchPriceFromUniswapV3(wrappedNative, quote, factory.address, factory.name, chainId, 'fast');
                } else {
                    priceData = await fetchPriceFromDex(wrappedNative, quote, factory.address, factory.name, chainId, 'fast');
                }
                if (priceData?.price) {
                    nativePriceCache[chainId] = { price: priceData.price, timestamp: Date.now() };
                    return priceData.price;
                }
            }

            for (const router of routers) {
                let routerData: OnChainPriceData | null = null;
                if (router.type === 'aerodrome') {
                    routerData = await fetchPriceFromAerodrome(wrappedNative, quote, router.address, chainId, 'fast');
                } else if (router.type === 'v2') {
                    routerData = await fetchPriceFromV2Router(wrappedNative, quote, router.address, router.name, chainId, 'fast');
                }
                if (routerData?.price) {
                    nativePriceCache[chainId] = { price: routerData.price, timestamp: Date.now() };
                    return routerData.price;
                }
            }
        }
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'RPC native price failed', { chainId, error: err.message });
    }

    const symbol = NATIVE_COINBASE_SYMBOLS[chainId] || 'ETH';

    try {
        // Fast Coinbase API (stable, no rate limit)
        const response = await fetch(
            `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`,
            { signal: AbortSignal.timeout(3000) }
        );

        if (response.ok) {
            const data = await response.json();
            const price = parseFloat(data.data.amount);
            if (price && price > 0) {
                nativePriceCache[chainId] = { price, timestamp: Date.now() };
                return price;
            }
        }
    } catch {
        // Fallthrough to estimates
    }

    // Fallback: Use estimate
    const fallbackPrice = NATIVE_PRICE_ESTIMATES[chainId] || 2450;
    nativePriceCache[chainId] = { price: fallbackPrice, timestamp: Date.now() };
    return fallbackPrice;
}

/**
 * Generic eth_call wrapper with type safety
 */
async function callEthCall<T>(
    chainId: number,
    to: string,
    abi: any,
    functionName: string,
    args: any[],
    rpcStrategy: RpcStrategy
): Promise<T> {
    const data = encodeFunctionData({
        abi,
        functionName,
        args
    });

    const resultHex = await callRpcWithStrategy<string>(chainId, 'eth_call', [{
        to,
        data
    }, 'latest'], rpcStrategy);

    const decoded = decodeFunctionResult({
        abi,
        functionName,
        data: resultHex as `0x${string}`
    });

    return decoded as T;
}

async function fetchPriceFromUniswapV4PoolId(
    tokenAddress: string,
    quote: QuoteToken,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    if (!V4_STATE_VIEW[chainId]) return null;

    const pools = await findV4Pools(tokenAddress, quote.address, chainId);
    if (!pools.length) return null;

    const decimalsCache = new Map<string, number>();
    const getDecimals = async (address: string): Promise<number> => {
        const key = address.toLowerCase();
        if (decimalsCache.has(key)) return decimalsCache.get(key)!;
        const dec = await getErc20Decimals(address, chainId).catch(() => 18);
        decimalsCache.set(key, dec);
        return dec;
    };

    for (const pool of pools) {
        try {
            if (!pool.liquidity || BigInt(pool.liquidity) <= 0n) continue;
            const sqrtPriceX96 = BigInt(pool.sqrtPriceX96);
            if (sqrtPriceX96 === 0n) continue;

            const token0 = pool.poolKey.currency0;
            const token1 = pool.poolKey.currency1;
            const decimals0 = await getDecimals(token0);
            const decimals1 = await getDecimals(token1);
            const priceToken1PerToken0 = calculatePriceFromSqrtX96(sqrtPriceX96, decimals0, decimals1);

            let priceInQuote: number | null = null;
            if (tokenAddress.toLowerCase() === token0.toLowerCase() && quote.address.toLowerCase() === token1.toLowerCase()) {
                priceInQuote = priceToken1PerToken0;
            } else if (tokenAddress.toLowerCase() === token1.toLowerCase() && quote.address.toLowerCase() === token0.toLowerCase()) {
                priceInQuote = priceToken1PerToken0 > 0 ? 1 / priceToken1PerToken0 : null;
            }

            if (!priceInQuote || !Number.isFinite(priceInQuote) || priceInQuote <= 0) continue;

            const priceUsd = priceInQuote * quote.usdPrice;

            let marketCap = 0;
            try {
                const totalSupply = await callEthCall<bigint>(
                    chainId,
                    tokenAddress,
                    ERC20_ABI,
                    'totalSupply',
                    [],
                    rpcStrategy
                );
                const tokenDecimals = await getDecimals(tokenAddress);
                const totalSupplyFormatted = Number(totalSupply) / Math.pow(10, tokenDecimals);
                marketCap = totalSupplyFormatted * priceUsd;
            } catch {
                marketCap = 0;
            }

            return {
                price: priceUsd,
                marketCap,
                pairAddress: pool.poolId,
                dexName: 'Uniswap V4 (poolId)'
            };
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * ⚡ Fetch price from Uniswap V4 Quoter
 * V4 uses PoolKey struct with hooks support
 * [Ref]: https://docs.uniswap.org/contracts/v4/overview
 */
async function fetchPriceFromUniswapV4(
    tokenAddress: string,
    quote: QuoteToken,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    const quoterAddress = QUOTER_V4_ADDRESSES[chainId];
    if (!quoterAddress) return null;

    try {
        // Sort tokens for PoolKey (currency0 < currency1)
        const [currency0, currency1] = tokenAddress.toLowerCase() < quote.address.toLowerCase()
            ? [tokenAddress, quote.address]
            : [quote.address, tokenAddress];

        const zeroForOne = quote.address.toLowerCase() === currency0.toLowerCase();
        const amountIn = ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);

        // Try each pool config (fee + tickSpacing)
        for (const config of V4_POOL_CONFIGS) {
            try {
                // Construct PoolKey (hooks = 0x0 for pools without custom hooks)
                const poolKey = {
                    currency0: currency0,
                    currency1: currency1,
                    fee: config.fee,
                    tickSpacing: config.tickSpacing,
                    hooks: '0x0000000000000000000000000000000000000000'
                };

                const params = {
                    poolKey: poolKey,
                    zeroForOne: zeroForOne,
                    exactAmount: amountIn,
                    hookData: '0x'
                };

                // Encode the call
                const callData = quoterV4Interface.encodeFunctionData('quoteExactInputSingle', [params]);

                // V4 Quoter uses revert-based returns, eth_call still works
                const result = await callRpcWithStrategy<string>(chainId, 'eth_call', [{
                    to: quoterAddress,
                    data: callData
                }, 'latest'], rpcStrategy);

                if (!result || result === '0x' || result.length < 66) {
                    continue; // Try next fee tier
                }

                // Decode result
                const decoded = quoterV4Interface.decodeFunctionResult('quoteExactInputSingle', result);
                const amountOut = decoded[0] as bigint;

                if (amountOut <= BigInt(0)) {
                    continue;
                }

                // Get token decimals
                const tokenDecimals = await callEthCall<number>(
                    chainId,
                    tokenAddress,
                    ERC20_ABI,
                    'decimals',
                    [],
                    rpcStrategy
                );

                // Calculate price
                // If zeroForOne: we're swapping Quote -> Token, amountOut is token amount
                const quoteAmount = Number(amountIn) / Math.pow(10, quote.decimals);
                const tokenAmount = Number(amountOut) / Math.pow(10, tokenDecimals);
                // amountIn is always quote token amount; amountOut is token amount
                const priceInQuote = tokenAmount > 0 ? (quoteAmount / tokenAmount) : 0;
                const priceUsd = priceInQuote * quote.usdPrice;

                // Get market cap
                let marketCap = 0;
                try {
                    const totalSupply = await callEthCall<bigint>(
                        chainId,
                        tokenAddress,
                        ERC20_ABI,
                        'totalSupply',
                        [],
                        rpcStrategy
                    );
                    marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;
                } catch {
                    marketCap = 0;
                }

                logger.info(LogCode.API_FETCH_SUCCESS, `⚡ Uniswap V4 price fetched`, {
                    token: tokenAddress,
                    price: priceUsd.toFixed(12),
                    fee: config.fee / 10000 + '%'
                });

                return {
                    price: priceUsd,
                    marketCap,
                    pairAddress: quoterAddress,
                    dexName: `Uniswap V4 (${config.fee / 10000}%)`
                };
            } catch {
                // Try next fee tier
                continue;
            }
        }

        return null;
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Uniswap V4 Quoter failed', {
            token: tokenAddress,
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Fetch price from Uniswap V3 Pool
 * ⚡ QUOTER V2: Single Multicall using QuoterV2 for instant price quotes!
 * 🔄 FALLBACK: If QuoterV2 fails, falls back to getPool + slot0 method
 */
async function fetchPriceFromUniswapV3(
    tokenAddress: string,
    quote: QuoteToken,
    factoryAddress: string,
    dexName: string,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    const FEE_TIERS = [10000, 3000, 500]; // 1%, 0.3%, 0.05%
    const quoterAddress = QUOTER_V2_ADDRESSES[chainId];

    // Try QuoterV2 first (fastest path)
    if (quoterAddress) {
        try {
            const result = await tryQuoterV2(tokenAddress, quote, quoterAddress, dexName, chainId, FEE_TIERS, rpcStrategy);
            if (result) return result;
        } catch {
            // QuoterV2 failed, try fallback
        }
    }

    // 🔄 FALLBACK: getPool + slot0 method (2 Multicalls)
    return tryGetPoolSlot0Fallback(tokenAddress, quote, factoryAddress, dexName, chainId, FEE_TIERS, rpcStrategy);
}

/**
 * Try QuoterV2 method - single Multicall
 */
async function tryQuoterV2(
    tokenAddress: string,
    quote: QuoteToken,
    quoterAddress: string,
    dexName: string,
    chainId: number,
    FEE_TIERS: number[],
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    const amountIn = BigInt(10) ** BigInt(18);

    const calls: { target: string; allowFailure: boolean; callData: string }[] = [];

    for (const fee of FEE_TIERS) {
        const quoteParams = {
            tokenIn: tokenAddress,
            tokenOut: quote.address,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
        };

        calls.push({
            target: quoterAddress,
            allowFailure: true,
            callData: quoterV2Interface.encodeFunctionData('quoteExactInputSingle', [quoteParams])
        });
    }

    calls.push({
        target: tokenAddress,
        allowFailure: false,
        callData: erc20Interface.encodeFunctionData('decimals', [])
    });

    calls.push({
        target: tokenAddress,
        allowFailure: true,
        callData: erc20Interface.encodeFunctionData('totalSupply', [])
    });

    const batchData = multicall3Interface.encodeFunctionData('aggregate3', [calls]);

    const batchResult = await callRpcWithStrategy<string>(
        chainId,
        'eth_call',
        [{ to: MULTICALL3_ADDRESS, data: batchData }, 'latest'],
        rpcStrategy
    );

    const decoded = multicall3Interface.decodeFunctionResult('aggregate3', batchResult);
    const results = decoded[0] as { success: boolean; returnData: string }[];

    let amountOut: bigint | null = null;
    let selectedFee = 0;

    for (let i = 0; i < FEE_TIERS.length; i++) {
        if (results[i].success && results[i].returnData.length > 2) {
            try {
                const quoteResult = quoterV2Interface.decodeFunctionResult('quoteExactInputSingle', results[i].returnData);
                amountOut = quoteResult[0] as bigint;
                if (amountOut > BigInt(0)) {
                    selectedFee = FEE_TIERS[i];
                    break;
                }
            } catch {
                continue;
            }
        }
    }

    if (!amountOut || amountOut === BigInt(0)) {
        return null;
    }

    const tokenDecimals = Number(erc20Interface.decodeFunctionResult('decimals', results[3].returnData)[0]);

    let totalSupply = BigInt(0);
    if (results[4].success) {
        totalSupply = erc20Interface.decodeFunctionResult('totalSupply', results[4].returnData)[0] as bigint;
    }

    const amountInFloat = Number(amountIn) / Math.pow(10, tokenDecimals);
    const amountOutFloat = Number(amountOut) / Math.pow(10, quote.decimals);
    if (amountInFloat <= 0) return null;
    const priceInQuote = amountOutFloat / amountInFloat;
    const priceUsd = priceInQuote * quote.usdPrice;
    const marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;

    return {
        price: priceUsd,
        marketCap,
        pairAddress: '',
        dexName: `${dexName} (V3 ${selectedFee / 10000}%)`
    };
}

/**
 * Fallback: getPool + slot0 method (2 Multicalls)
 */
async function tryGetPoolSlot0Fallback(
    tokenAddress: string,
    quote: QuoteToken,
    factoryAddress: string,
    dexName: string,
    chainId: number,
    FEE_TIERS: number[],
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    try {
        // Multicall 1: getPool for each fee tier + decimals + totalSupply
        const calls: { target: string; allowFailure: boolean; callData: string }[] = [];

        for (const fee of FEE_TIERS) {
            calls.push({
                target: factoryAddress,
                allowFailure: true,
                callData: factoryV3Interface.encodeFunctionData('getPool', [tokenAddress, quote.address, fee])
            });
        }

        calls.push({
            target: tokenAddress,
            allowFailure: false,
            callData: erc20Interface.encodeFunctionData('decimals', [])
        });

        calls.push({
            target: tokenAddress,
            allowFailure: true,
            callData: erc20Interface.encodeFunctionData('totalSupply', [])
        });

        const batchData = multicall3Interface.encodeFunctionData('aggregate3', [calls]);

        const batchResult = await callRpcWithStrategy<string>(
            chainId,
            'eth_call',
            [{ to: MULTICALL3_ADDRESS, data: batchData }, 'latest'],
            rpcStrategy
        );

        const decoded = multicall3Interface.decodeFunctionResult('aggregate3', batchResult);
        const results = decoded[0] as { success: boolean; returnData: string }[];

        // Find first valid pool
        let poolAddress: string | null = null;
        let fee = 0;
        for (let i = 0; i < FEE_TIERS.length; i++) {
            if (results[i].success && results[i].returnData !== '0x' && results[i].returnData.length > 2) {
                const addr = factoryV3Interface.decodeFunctionResult('getPool', results[i].returnData)[0] as string;
                if (addr && addr !== '0x0000000000000000000000000000000000000000') {
                    poolAddress = addr;
                    fee = FEE_TIERS[i];
                    break;
                }
            }
        }

        if (!poolAddress) {
            return null;
        }

        // Multicall 2: slot0 + token0
        const poolCalls = [
            { target: poolAddress, allowFailure: false, callData: poolV3Interface.encodeFunctionData('slot0', []) },
            { target: poolAddress, allowFailure: false, callData: poolV3Interface.encodeFunctionData('token0', []) }
        ];

        const poolBatchData = multicall3Interface.encodeFunctionData('aggregate3', [poolCalls]);
        const poolResult = await callRpcWithStrategy<string>(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: poolBatchData }, 'latest'], rpcStrategy);

        const poolDecoded = multicall3Interface.decodeFunctionResult('aggregate3', poolResult);
        const poolResults = poolDecoded[0] as { success: boolean; returnData: string }[];

        const slot0 = poolV3Interface.decodeFunctionResult('slot0', poolResults[0].returnData);
        const token0 = poolV3Interface.decodeFunctionResult('token0', poolResults[1].returnData)[0] as string;
        const tokenDecimals = Number(erc20Interface.decodeFunctionResult('decimals', results[3].returnData)[0]);

        let totalSupply = BigInt(0);
        if (results[4].success) {
            totalSupply = erc20Interface.decodeFunctionResult('totalSupply', results[4].returnData)[0] as bigint;
        }

        // Calculate price
        const sqrtPriceX96 = slot0[0] as bigint;
        const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
        const Q96 = BigInt(2) ** BigInt(96);
        const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
        const price = sqrtPrice * sqrtPrice;
        const decimalAdjustment = Math.pow(10, quote.decimals - tokenDecimals);
        const priceInQuote = isToken0 ? price * decimalAdjustment : (1 / price) / decimalAdjustment;
        const priceUsd = priceInQuote * quote.usdPrice;

        const marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;

        return {
            price: priceUsd,
            marketCap,
            pairAddress: poolAddress,
            dexName: `${dexName} (V3 ${fee / 10000}%)`
        };
    } catch (err) {
        return null;
    }
}

/**
 * Fetch price from FourMeme Bonding Curve (TokenManager2)
 * Uses TokenManagerHelper3 to get token info and calculate price
 */
async function fetchPriceFromBondingCurve(
    tokenAddress: string,
    tokenManagerAddress: string,
    dexName: string,
    chainId: number,
    rpcStrategy: RpcStrategy
): Promise<OnChainPriceData | null> {
    try {
        // FourMeme TokenManagerHelper3 ABI (minimal)
        const HELPER_ABI = parseAbi([
            'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)'
        ]);

        // TokenManagerHelper3 address on BSC
        const HELPER_ADDRESS = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';

        const tokenInfo = await callEthCall<any>(
            chainId,
            HELPER_ADDRESS,
            HELPER_ABI,
            'getTokenInfo',
            [tokenAddress],
            rpcStrategy
        );

        const lastPrice = tokenInfo[3]; // lastPrice from return values
        const quote = tokenInfo[2]; // quote token address

        // Convert price to USD
        let priceUsd = Number(lastPrice) / 1e18; // Price is in wei

        // If quote is not BNB (address(0)), need to get quote token price
        if (quote !== '0x0000000000000000000000000000000000000000') {
            // Quote is BEP20, need to convert to USD
            const quotePriceUsd = await getNativeTokenPriceUsd(chainId);
            priceUsd = priceUsd * quotePriceUsd;
        } else {
            // Quote is BNB
            const bnbPrice = await getNativeTokenPriceUsd(chainId);
            priceUsd = priceUsd * bnbPrice;
        }

        // Calculate market cap
        let marketCap = 0;
        try {
            const totalSupply = await callEthCall<bigint>(
                chainId,
                tokenAddress,
                ERC20_ABI,
                'totalSupply',
                [],
                rpcStrategy
            );
            const decimals = await callEthCall<number>(
                chainId,
                tokenAddress,
                ERC20_ABI,
                'decimals',
                [],
                rpcStrategy
            );
            const totalSupplyFloat = Number(totalSupply) / Math.pow(10, decimals);
            marketCap = totalSupplyFloat * priceUsd;
        } catch {
            marketCap = 0;
        }

        return {
            price: priceUsd,
            marketCap: marketCap,
            pairAddress: tokenManagerAddress,
            dexName: dexName
        };
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'FourMeme bonding curve query failed', {
            error: err.message,
            token: tokenAddress
        });
        return null;
    }
}
