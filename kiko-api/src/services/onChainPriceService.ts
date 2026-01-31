/**
 * On-Chain Price Service (RPC Fallback)
 * Fetches price, liquidity, and market cap directly from chain via RPC
 * Used when DexScreener/GeckoTerminal APIs fail
 */

import { callRpc } from './rpcManager.js';
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';
import { getChainConfig } from '../config/chainConfig.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { ethers } from 'ethers';

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

// QuoterV2 addresses per chain
const QUOTER_V2_ADDRESSES: Record<number, string> = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',     // Ethereum
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',  // Base
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Arbitrum
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',    // Optimism
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',   // Polygon
};

// ⚡ PRICE CACHE: Sub-10ms reads for repeated queries
interface PriceCache {
    price: number;
    marketCap: number;
    timestamp: number;
    dexName: string;
}
const priceCache = new Map<string, PriceCache>();
const PRICE_CACHE_TTL = 5000; // 5 second cache

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

/**
 * Fetch token price and liquidity directly from chain
 * Falls back to multiple DEXes if first fails
 * ⚡ OPTIMIZED: Cache + Multicall for sub-100ms queries
 */
export async function getOnChainPrice(
    tokenAddress: string,
    chainId: number
): Promise<OnChainPriceData | null> {
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

    const chainConfig = getChainConfig(chainId);
    const wrappedNative = chainConfig.wrappedNativeAddress;
    const factories = DEX_FACTORIES[chainId] || [];

    if (factories.length === 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'No DEX factories configured for chain', { chainId });
        return null;
    }

    // Try each DEX factory until one succeeds
    // ⚡ PARALLEL DEX QUERIES: Race all factories, first success wins
    const fetchPromises = factories.map(async (factory) => {
        try {
            let priceData: OnChainPriceData | null = null;

            // Route to appropriate fetcher based on version
            if (factory.version === 'v3') {
                priceData = await fetchPriceFromUniswapV3(
                    tokenAddress,
                    wrappedNative,
                    factory.address,
                    factory.name,
                    chainId
                );
            } else if (factory.version === 'bonding') {
                priceData = await fetchPriceFromBondingCurve(
                    tokenAddress,
                    factory.address,
                    factory.name,
                    chainId
                );
            } else {
                // V2 or default
                priceData = await fetchPriceFromDex(
                    tokenAddress,
                    wrappedNative,
                    factory.address,
                    factory.name,
                    chainId
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

    // Wait for all to complete, then pick first successful
    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
            const data = result.value.data;

            // ⚡ CACHE SAVE: Store for instant future queries
            priceCache.set(cacheKey, {
                price: data.price,
                marketCap: data.marketCap,
                timestamp: Date.now(),
                dexName: result.value.factory
            });

            logger.info(LogCode.API_FETCH_SUCCESS, `On-chain price fetched from ${result.value.factory}`, {
                token: tokenAddress,
                price: data.price,
                marketCap: data.marketCap
            });
            return data;
        }
    }

    logger.warn(LogCode.API_FETCH_FAILED, 'All on-chain DEX queries failed', { token: tokenAddress, chainId });
    return null;
}

/**
 * Fetch price from a specific DEX factory
 * Note: Only fetches price and market cap. Liquidity is unreliable on-chain and should come from APIs.
 */
async function fetchPriceFromDex(
    tokenAddress: string,
    wrappedNative: string,
    factoryAddress: string,
    dexName: string,
    chainId: number
): Promise<OnChainPriceData | null> {
    // Step 1: Get pair address from factory
    const pairAddress = await callEthCall<string>(
        chainId,
        factoryAddress,
        FACTORY_V2_ABI,
        'getPair',
        [tokenAddress, wrappedNative]
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
        []
    );

    // Step 3: Determine which reserve is token vs native
    const token0 = await callEthCall<string>(
        chainId,
        pairAddress,
        PAIR_V2_ABI,
        'token0',
        []
    );

    const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
    const tokenReserve = isToken0 ? reserve0 : reserve1;
    const nativeReserve = isToken0 ? reserve1 : reserve0;

    // Step 4: Get decimals
    const tokenDecimals = await callEthCall<number>(
        chainId,
        tokenAddress,
        ERC20_ABI,
        'decimals',
        []
    );

    const nativeDecimals = 18; // WETH/WBNB always 18 decimals

    // Step 5: Calculate price (native per token)
    const tokenReserveFloat = Number(tokenReserve) / Math.pow(10, tokenDecimals);
    const nativeReserveFloat = Number(nativeReserve) / Math.pow(10, nativeDecimals);

    if (tokenReserveFloat === 0) {
        return null; // No liquidity
    }

    const priceInNative = nativeReserveFloat / tokenReserveFloat;

    // Step 6: Get native token price in USD (fetch from cache or hardcode estimate)
    const nativePriceUsd = await getNativeTokenPriceUsd(chainId);
    const priceUsd = priceInNative * nativePriceUsd;

    // Step 7: Estimate market cap (total supply × price)
    let marketCap = 0;
    try {
        const totalSupply = await callEthCall<bigint>(
            chainId,
            tokenAddress,
            ERC20_ABI,
            'totalSupply',
            []
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
 * Get native token price in USD (ETH, BNB, etc.)
 * ⚡ OPTIMIZED: 10-minute cache + background refresh
 */
let nativePriceCache: { [chainId: number]: { price: number; timestamp: number } } = {};
const NATIVE_PRICE_CACHE_TTL = 600000; // 10 minutes cache

// Native token IDs for CoinGecko
const NATIVE_COINGECKO_IDS: Record<number, string> = {
    1: 'ethereum',
    8453: 'ethereum', // Base uses ETH
    56: 'binancecoin',
    42161: 'ethereum', // Arbitrum uses ETH
    10: 'ethereum', // Optimism uses ETH
    137: 'matic-network',
};

// Fallback prices (updated 2026-01)
const NATIVE_PRICE_ESTIMATES: Record<number, number> = {
    1: 2650,    // ETH ~$2650
    8453: 2650, // Base (ETH)
    56: 600,    // BNB ~$600
    42161: 2650, // Arbitrum (ETH)
    10: 2650,   // Optimism (ETH)
    137: 0.5,   // Polygon (MATIC)
};

/**
 * ⚡ PRELOAD: Fetch all native token prices at startup
 * Call this when the server starts to warm the cache
 */
export async function preloadNativeTokenPrices(): Promise<void> {
    logger.info(LogCode.API_FETCH_SUCCESS, '⚡ Preloading native token prices...');

    const chainIds = Object.keys(NATIVE_COINGECKO_IDS).map(Number);
    const uniqueCoins = [...new Set(Object.values(NATIVE_COINGECKO_IDS))];

    try {
        // Fetch all coins in one API call
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCoins.join(',')}&vs_currencies=usd`,
            { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
            const data = await response.json();
            const now = Date.now();

            // Cache prices for all chains
            for (const chainId of chainIds) {
                const coinId = NATIVE_COINGECKO_IDS[chainId];
                const price = data[coinId]?.usd;
                if (price && price > 0) {
                    nativePriceCache[chainId] = { price, timestamp: now };
                }
            }

            logger.info(LogCode.API_FETCH_SUCCESS, '⚡ Native token prices cached', {
                eth: data['ethereum']?.usd,
                bnb: data['binancecoin']?.usd,
                chains: chainIds.length
            });
        }
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to preload native prices, using fallbacks', { error: error.message });

        // Use fallback prices
        const now = Date.now();
        for (const chainId of chainIds) {
            nativePriceCache[chainId] = {
                price: NATIVE_PRICE_ESTIMATES[chainId] || 2650,
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

async function getNativeTokenPriceUsd(chainId: number): Promise<number> {
    // Check memory cache first (should always hit after preload)
    const cached = nativePriceCache[chainId];
    if (cached && Date.now() - cached.timestamp < NATIVE_PRICE_CACHE_TTL) {
        return cached.price;
    }

    const coinId = NATIVE_COINGECKO_IDS[chainId] || 'ethereum';

    try {
        // Fast CoinGecko simple price API
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
            { signal: AbortSignal.timeout(3000) }
        );

        if (response.ok) {
            const data = await response.json();
            const price = data[coinId]?.usd;
            if (price && price > 0) {
                nativePriceCache[chainId] = { price, timestamp: Date.now() };
                return price;
            }
        }
    } catch {
        // Fallthrough to estimates
    }

    // Fallback: Use estimate
    const fallbackPrice = NATIVE_PRICE_ESTIMATES[chainId] || 2650;
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
    args: any[]
): Promise<T> {
    const data = encodeFunctionData({
        abi,
        functionName,
        args
    });

    const resultHex = await callRpc<string>(chainId, 'eth_call', [{
        to,
        data
    }, 'latest']);

    const decoded = decodeFunctionResult({
        abi,
        functionName,
        data: resultHex as `0x${string}`
    });

    return decoded as T;
}

/**
 * Fetch price from Uniswap V3 Pool
 * ⚡ QUOTER V2: Single Multicall using QuoterV2 for instant price quotes!
 */
async function fetchPriceFromUniswapV3(
    tokenAddress: string,
    wrappedNative: string,
    factoryAddress: string,
    dexName: string,
    chainId: number
): Promise<OnChainPriceData | null> {
    const FEE_TIERS = [10000, 3000, 500]; // 1%, 0.3%, 0.05%
    const quoterAddress = QUOTER_V2_ADDRESSES[chainId];

    if (!quoterAddress) {
        return null; // QuoterV2 not available on this chain
    }

    try {
        // Amount to quote: 1 token (will scale by decimals later)
        const amountIn = BigInt(10) ** BigInt(18); // 1 token with 18 decimals

        // ⚡ SINGLE MULTICALL: Quote all fee tiers + get decimals + totalSupply
        const calls: { target: string; allowFailure: boolean; callData: string }[] = [];

        // Quotes for each fee tier (indices 0-2)
        for (const fee of FEE_TIERS) {
            const quoteParams = {
                tokenIn: tokenAddress,
                tokenOut: wrappedNative,
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

        // Token decimals (index 3)
        calls.push({
            target: tokenAddress,
            allowFailure: false,
            callData: erc20Interface.encodeFunctionData('decimals', [])
        });

        // Token totalSupply (index 4)
        calls.push({
            target: tokenAddress,
            allowFailure: true,
            callData: erc20Interface.encodeFunctionData('totalSupply', [])
        });

        const batchData = multicall3Interface.encodeFunctionData('aggregate3', [calls]);

        // ⚡ PARALLEL: Single RPC call + native price  
        const [batchResult, nativePriceUsd] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: batchData }, 'latest']),
            getNativeTokenPriceUsd(chainId)
        ]);

        const decoded = multicall3Interface.decodeFunctionResult('aggregate3', batchResult);
        const results = decoded[0] as { success: boolean; returnData: string }[];

        // Find first successful quote
        let amountOut: bigint | null = null;
        let selectedFee = 0;

        for (let i = 0; i < FEE_TIERS.length; i++) {
            if (results[i].success && results[i].returnData.length > 2) {
                try {
                    const quoteResult = quoterV2Interface.decodeFunctionResult('quoteExactInputSingle', results[i].returnData);
                    amountOut = quoteResult[0] as bigint; // amountOut is first return value

                    if (amountOut > BigInt(0)) {
                        selectedFee = FEE_TIERS[i];
                        break;
                    }
                } catch {
                    continue; // Try next fee tier
                }
            }
        }

        if (!amountOut || amountOut === BigInt(0)) {
            return null; // No valid quote found
        }

        // Decode token data
        const tokenDecimals = Number(erc20Interface.decodeFunctionResult('decimals', results[3].returnData)[0]);

        let totalSupply = BigInt(0);
        if (results[4].success) {
            totalSupply = erc20Interface.decodeFunctionResult('totalSupply', results[4].returnData)[0] as bigint;
        }

        // Calculate price: how much native token we get for 1 input token
        const scaledAmountIn = BigInt(10) ** BigInt(tokenDecimals);
        const nativeDecimals = 18;

        // Price = amountOut / amountIn (adjusted for decimals)
        const priceInNative = (Number(amountOut) / Number(amountIn)) * (Number(scaledAmountIn) / Number(BigInt(10) ** BigInt(tokenDecimals)));
        const priceUsd = priceInNative * nativePriceUsd;

        const marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;

        return {
            price: priceUsd,
            marketCap,
            pairAddress: '', // QuoterV2 doesn't return pool address
            dexName: `${dexName} (V3 ${selectedFee / 10000}%)`
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
    chainId: number
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
            [tokenAddress]
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
                []
            );
            const decimals = await callEthCall<number>(
                chainId,
                tokenAddress,
                ERC20_ABI,
                'decimals',
                []
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
