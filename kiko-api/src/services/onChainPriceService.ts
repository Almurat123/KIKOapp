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

// Known DEX Factory addresses by chain (2026 Official Deployments)
const DEX_FACTORIES: Record<number, { name: string; address: string; version: string }[]> = {
    1: [ // Ethereum
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Sushiswap', address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', version: 'v2' }
    ],
    8453: [ // Base (2026 Official)
        { name: 'Uniswap V3', address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', version: 'v3' },
        { name: 'Aerodrome', address: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', version: 'v2' }, // Aerodrome main DEX on Base
        { name: 'BaseSwap', address: '0xFDa619b6d20975be80A10332dD6a09952FB6EFA0', version: 'v2' }
    ],
    56: [ // BSC (2026 Official)
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
 */
export async function getOnChainPrice(
    tokenAddress: string,
    chainId: number
): Promise<OnChainPriceData | null> {
    const chainConfig = getChainConfig(chainId);
    const wrappedNative = chainConfig.wrappedNativeAddress;
    const factories = DEX_FACTORIES[chainId] || [];

    if (factories.length === 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'No DEX factories configured for chain', { chainId });
        return null;
    }

    // Try each DEX factory until one succeeds
    for (const factory of factories) {
        try {
            const priceData = await fetchPriceFromDex(
                tokenAddress,
                wrappedNative,
                factory.address,
                factory.name,
                chainId
            );

            if (priceData) {
                logger.info(LogCode.API_FETCH_SUCCESS, `On-chain price fetched from ${factory.name}`, {
                    token: tokenAddress,
                    price: priceData.price,
                    marketCap: priceData.marketCap
                });
                return priceData;
            }
        } catch (err: any) {
            logger.debug(LogCode.API_FETCH_FAILED, `Failed to fetch from ${factory.name}`, {
                error: err.message,
                chainId
            });
            continue; // Try next DEX
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
 * Uses hardcoded estimates if APIs fail
 */
async function getNativeTokenPriceUsd(chainId: number): Promise<number> {
    // Try to fetch from getTokenInfo cache first
    try {
        const { getTokenInfo } = await import('./tokenService.js');
        const chainConfig = getChainConfig(chainId);
        const nativeInfo = await getTokenInfo(chainConfig.wrappedNativeAddress, chainId, { 
            verbose: false, 
            forceRefresh: false 
        });
        
        if (nativeInfo && nativeInfo.price > 0) {
            return nativeInfo.price;
        }
    } catch {
        // Fallthrough to hardcoded estimates
    }

    // Fallback: Hardcoded estimates (updated periodically)
    const NATIVE_PRICE_ESTIMATES: Record<number, number> = {
        1: 3200,    // ETH ~$3200
        8453: 3200, // Base (ETH)
        56: 600,    // BNB ~$600
        42161: 3200, // Arbitrum (ETH)
        10: 3200,   // Optimism (ETH)
        137: 1.0,   // Polygon (MATIC) ~$1
    };

    return NATIVE_PRICE_ESTIMATES[chainId] || 3000; // Default to ETH estimate
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
